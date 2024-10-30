import { v4 as uuid } from "uuid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventQueryStringParameters,
} from "aws-lambda";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { TxmaEvent } from "../common/models";
import { userScenarios } from "../scenarios/scenarios";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { convertClassInstanceToMap: true },
});

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

export interface Response {
  statusCode: number;
  headers: {
    Location: string;
  };
}

const newTxmaEvent = (): TxmaEvent => ({
  event_id: uuid(),
  timestamp: Date.now(),
  event_name: "AUTH_AUTH_CODE_ISSUED",
  client_id: "vehicleOperatorLicense",
  user: {
    user_id: "user_id",
    session_id: uuid(),
  },
});

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string
): Promise<string | undefined> => {
  if (!queueUrl) throw new Error("Queue URL is not defined.");

  const result = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    })
  );
  return result.MessageId;
};

export const writeNonce = async (
  code: string,
  nonce: string,
  userId = "F5CE808F-75AB-4ECD-BBFC-FF9DBF5330FA",
  remove_at: number
): Promise<PutCommandOutput> => {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error("DynamoDB Table Name is not defined.");

  return dynamoDocClient.send(
    new PutCommand({
      TableName: tableName,
      Item: { code, nonce, userId, remove_at },
    })
  );
};

export const selectScenarioHandler = async (event: APIGatewayProxyEvent) => {
  const { state, nonce, redirect_uri } =
    event.queryStringParameters as APIGatewayProxyEventQueryStringParameters;

  const scenariosHtml = Object.keys(userScenarios)
    .map(
      (scenario) =>
        `<button name="scenario" value="${scenario}">${scenario}</button>`
    )
    .join("<br/>");

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
        <body>
          <form method="post" action='/authorize'>
            <input type="hidden" name="state" value="${state}" />
            <input type="hidden" name="nonce" value="${nonce}" /> 
            <input type="hidden" name="redirectUri" value="${redirect_uri}" />
            <h1>API Simulation Tool</h1>
            <p>Choose a scenario below instead of logging in. The app will act like you're that user, helping you test its behavior in different situations.</p>
            ${scenariosHtml}
          </form>
        </body>
      </html>`,
  };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<Response> => {
  if (!event.body) throw new Error("Request body is missing.");

  const properties = new URLSearchParams(event.body);
  const nonce = properties.get("nonce");
  const state = properties.get("state");
  const redirectUri = properties.get("redirectUri");
  const scenario = properties.get("scenario") || "default";

  if (!nonce || !state || !redirectUri)
    throw new Error("Required parameters are missing in the request body.");

  const queueUrl = process.env.DUMMY_TXMA_QUEUE_URL;
  if (!queueUrl)
    throw new Error("TXMA Queue URL environment variable is not set.");

  const code = uuid();
  const remove_at = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

  try {
    await Promise.all([
      writeNonce(code, nonce, scenario, remove_at),
      sendSqsMessage(JSON.stringify(newTxmaEvent()), queueUrl),
    ]);

    return {
      statusCode: 302,
      headers: {
        Location: `${redirectUri}?state=${state}&code=${code}`,
      },
    };
  } catch (error) {
    console.error(`Error :: ${error}`);
    return {
      statusCode: 500,
      headers: {
        Location: "Internal Server Error",
      },
    };
  }
};
