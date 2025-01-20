import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Response, handler } from "../../oidc/token";
import { Token } from "../../common/models";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const tableName = "TableName";
const code = "1234";
const nonce = "G-MyuYjjh6zpDlfhiKVb";

const oicdPersistedData = {
  code,
  nonce,
};

jest.mock("../../oidc/validate-token");

describe("handler", () => {
  beforeEach(() => {
    process.env.OIDC_CLIENT_ID = "12345";
    process.env.ENVIRONMENT = "dev";
    process.env.JWK_KEY_SECRET = JSON.stringify(
      '{"kty":"EC","d":"Ob4_qMu1nkkBLEw97u--PHVsShP3xOKOJ6z0WsdU0Xw","use":"sig","crv":"P-256","kid":"B-QMUxdJOJ8ubkmArc4i1SGmfZnNNlM-va9h0HJ0jCo","x":"YrTTzbuUwQhWyaj11w33k-K8bFydLfQssVqr8mx6AVE","y":"8UQcw-6Wp0bp8iIIkRw8PW2RSSjmj1I_8euyKEDtWRk","alg":"ES256"}'
    );
    process.env.TABLE_NAME = tableName;
    dynamoMock.reset();
    dynamoMock.on(GetCommand).resolves({ Item: oicdPersistedData });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 OK response including body with access token", async () => {
    const mockApiEvent: APIGatewayProxyEvent = {
      body: "client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer&client_assertion=eyJhbGkpXVCJ9.ey5BPMzRJIn0.RmHvYkaw&grant_type=authorization_code&code=ccca4dec-6799-413c-ab45-896d050006b5&redirect_uri=https%3A%2F%2Fhome.dev.account.gov.uk%2Fauth%2Fcallback",
    } as never;
    const result: Response = await handler(mockApiEvent);
    const body: Token = JSON.parse(result.body);
    expect(result.statusCode).toEqual(200);
    expect(body.id_token).toContain(
      "eyJraWQiOiJCLVFNVXhkSk9KOHVia21BcmM0aTFTR21mWm5OTmxNLXZhOWgwSEowakNvIiwiYWxnIjoiRVMyNTYifQ."
    );
  });

  test("returns 500 error response if event body is undefined", async () => {
    const mockApiEvent: APIGatewayProxyEvent = {
      body: "",
    } as never;
    let errorThrown = false;
    try {
      await handler(mockApiEvent);
    } catch (error) {
      errorThrown = true;
    }
    expect(errorThrown).toBeTruthy();
  });
});
