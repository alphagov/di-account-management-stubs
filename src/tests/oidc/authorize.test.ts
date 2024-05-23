import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const queueUrl = "http://my_queue_url";
const redirectUrl = "http://home.account.gov.uk/auth/callback";
const tableName = "TABLE_NAME";

jest.mock("uuid", () => ({ v4: () => "12345" }));

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.DUMMY_TXMA_QUEUE_URL = queueUrl;
    process.env.ACCOUNT_MANAGEMENT_URL = redirectUrl;
    process.env.TABLE_NAME = tableName;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "messageId" });
    dynamoMock.reset();
    dynamoMock.on(PutCommand).resolves({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // test("sends message to TXMA Queue and returns a redirect", async () => {
  //   const result: Response = await handler(
  //     mockApiEvent as APIGatewayProxyEvent
  //   );
  //   const redirectReturnUrl = `${redirectUrl}?state=${state}&code=12345`;

  //   expect(result.statusCode).toEqual(302);
  //   expect(result.headers.Location).toEqual(redirectReturnUrl);
  //   expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
  //   expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  // });
});
