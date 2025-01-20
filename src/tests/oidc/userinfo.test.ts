import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import { APIGatewayProxyEvent } from "aws-lambda/trigger/api-gateway-proxy";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { handler, Response } from "../../oidc/userinfo";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const tableName = "TABLE_NAME";

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        {
          userId: "user1",
        },
      ],
    });
    process.env.TABLE_NAME = tableName;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("returns status code 200", async () => {
    const mockApiEvent: APIGatewayProxyEvent = {
      body: "client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer&client_assertion=eyJhbGkpXVCJ9.ey5BPMzRJIn0.RmHvYkaw&grant_type=authorization_code&code=ccca4dec-6799-413c-ab45-896d050006b5&redirect_uri=https%3A%2F%2Fhome.dev.account.gov.uk%2Fauth%2Fcallback",
      headers: {
        Authorization:
          "eyJraWQiOiJCLVFNVXhkSk9KOHVia21BcmM0aTFTR21mWm5OTmxNLXZhOWgwSEowakNvIiwiYWxnIjoiRVMyNTYifQ.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjM2MzYxYzY0LTE0NzEtNDllNC1iY2Y0LWRhOTg2MzJlNDc1MyIsImlzcyI6Imh0dHBzOi8vb2lkYy1zdHViLmhvbWUuZGV2LmFjY291bnQuZ292LnVrLyIsImF1ZCI6IlZjZXI3LWl6OUJOcmRWRkctSlZxSjRrMm12dyIsImV4cCI6MTcxNDQ5NDEwOSwiaWF0IjoxNzE0NDkwNTA5LCJzaWQiOiI2MzRjZGE1Ny0zNmQ0LTRjMTEtYTQ2NS0wMTcwNmU2MjNhZTAiLCJub25jZSI6InhQTWtTcFpSbkVrYUdvdXA5MGRCIiwidm90IjoiQ2wuQ20ifQ.bymos9XVETXlHFB53qVhqcalNxUVx5bPCzef1lazthRqkzB-hr7DcIkzd51LEfoBF0MIppLz0vxQajEjgAQMvg",
      },
    } as never;
    const result: Response = await handler(mockApiEvent);
    expect(result.statusCode).toEqual(200);
  });
});
