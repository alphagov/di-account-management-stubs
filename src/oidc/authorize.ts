import { v4 as uuid } from "uuid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, PutCommandOutput } from "@aws-sdk/lib-dynamodb";
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

const dynamoClient = new DynamoDBClient({});

const sqsClient = new SQSClient({});

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
  messageBody: string
): Promise<string | undefined> => {
  const message: SendMessageRequest = {
    QueueUrl: process.env.DUMMY_TXMA_QUEUE_URL,
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
    TableName: process.env.TABLE_NAME,
    Item: {
      code,
      nonce,
      userId,
      remove_at,
    },
  });
  return dynamoClient.send(command);
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

  const code = uuid();
  const remove_at = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  try {
    await Promise.all([
      writeNonce(code, nonce, scenario, remove_at),
      sendSqsMessage(JSON.stringify(newTxmaEvent())),
    ]);

    return {
      statusCode: 302,
      headers: {
        Location: `${redirectUri}?state=${state}&code=${code}`,
      },
    };
  } catch (err) {
    console.error(`Error: ${err}`);
    return {
      statusCode: 500,
      headers: {
        Location: "Internal Server Error",
      },
    };
  }
};
