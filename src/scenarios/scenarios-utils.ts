import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import assert from "node:assert/strict";
import { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import { userScenarios } from "./scenarios";
import { OicdPersistedData, UserScenarios } from "./scenarios.interfaces";
import { v4 as uuidv4 } from "uuid";

const marshallOptions = {
  convertClassInstanceToMap: true,
};

const translateConfig = { marshallOptions };
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

const { TABLE_NAME } = process.env;

const parseJwt = (
  token: string
): {
  nonce: string;
} => {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
};

export const getUserIdFromEvent = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<string> => {
  const authHeader =
    event?.headers?.Authorization || event?.headers?.authorization;
  assert(TABLE_NAME, "TABLE_NAME environment variable not set");
  assert(authHeader, "There is no Authorization header in the request");

  const jwt = parseJwt(authHeader);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "OidcNonceIndex",
    KeyConditionExpression: "nonce = :nonce",
    ExpressionAttributeValues: {
      ":nonce": jwt.nonce,
    },
    Limit: 1,
  });
  const results = await dynamoDocClient.send(command);
  if (results.Items?.length !== 1) {
    throw new Error("nonce not found in DB");
  }
  return (
    (results.Items[0] as OicdPersistedData).userId ||
    "F5CE808F-75AB-4ECD-BBFC-FF9DBF5330FA"
  );
};

export const getUserScenario = <
  T extends keyof UserScenarios[keyof UserScenarios],
>(
  userId: keyof typeof userScenarios,
  scenario: T
): UserScenarios["default"][T] => {
  const id = userScenarios[userId] ? userId : "default";

  const response =
    userScenarios[id][scenario] || userScenarios.default[scenario];

  if ("email" in response) {
    response.email = `${id}@example.org`;
  }

  if (id === "userPerformanceTest" && "sub" in response) {
    response.sub = uuidv4();
  }

  return response;
};
