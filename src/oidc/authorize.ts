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
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { TxmaEvent } from "../common/models";
import { userScenarios } from "../scenarios/scenarios";
import assert from "node:assert/strict";

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

const { AWS_REGION, TABLE_NAME } = process.env;
const sqsClient = new SQSClient({ region: AWS_REGION });

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
  queueUrl: string | undefined
): Promise<string | undefined> => {
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  const result = await sqsClient.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const writeNonce = async (
  code: string,
  nonce: string,
  userId = "F5CE808F-75AB-4ECD-BBFC-FF9DBF5330FA",
  remove_at: number
): Promise<PutCommandOutput> => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      code,
      nonce,
      userId,
      remove_at,
    },
  });
  return dynamoDocClient.send(command);
};

export const selectScenarioHandler = async (event: APIGatewayProxyEvent) => {
  const queryStringParameters: APIGatewayProxyEventQueryStringParameters =
    event.queryStringParameters as APIGatewayProxyEventQueryStringParameters;

  const { state, nonce, redirect_uri } = queryStringParameters;

  const scenarios = Object.keys(userScenarios)
    .map((scenario) => {
      return `<button name="scenario" value="${scenario}">${scenario}</button>`;
    })
    .join("<br/>");

  const body = `<html><body>
      <form method="post" action='/authorize'>
        <input type="hidden" name="state" value="${state}" />
        <input type="hidden" name="nonce" value="${nonce}" /> 
        <input type="hidden" name="redirectUri" value="${redirect_uri}" />
        <h1>API Simulation Tool</h1>
        <p>Choose a scenario below instead of logging in. The app will act like you're that user, helping you test its behavior in different situations.</p>
        ${scenarios}
      </form>
    </body></html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body,
  };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<Response> => {
  assert(event.body, "no body");

  const properties = new URLSearchParams(event.body);
  const nonce = properties.get("nonce");
  const state = properties.get("state");
  const redirectUri = properties.get("redirectUri");
  const scenario = properties.get("scenario") || "default";

  assert(nonce, "no nonce");
  assert(state, "no state");
  assert(redirectUri, "no redirect url");

  const { DUMMY_TXMA_QUEUE_URL } = process.env;

  const code = uuid();

  if (
    typeof DUMMY_TXMA_QUEUE_URL === "undefined" ||
    typeof nonce === "undefined"
  ) {
    throw new Error(
      "TXMA Queue URL or Frontend URL environemnt variables is null"
    );
  }

  const remove_at = Math.floor(
    (new Date().getTime() + 24 * 60 * 60 * 1000) / 1000
  );

  try {
    await Promise.all([
      writeNonce(code, nonce, scenario, remove_at),
      sendSqsMessage(JSON.stringify(newTxmaEvent()), DUMMY_TXMA_QUEUE_URL),
    ]);

    return {
      statusCode: 302,
      headers: {
        Location: `${redirectUri}?state=${state}&code=${code}`,
      },
    };
  } catch (err) {
    console.error(`Error :: ${err}`);
    return {
      statusCode: 500,
      headers: {
        Location: "Internal Server Error ",
      },
    };
  }
};
