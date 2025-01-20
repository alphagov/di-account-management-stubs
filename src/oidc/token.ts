import { v4 as uuid } from "uuid";
import {
  importJWK,
  JWK,
  JWTHeaderParameters,
  JWTPayload,
  KeyLike,
  SignJWT,
} from "jose";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Token } from "../common/models";
import {
  validateClientIdMatches,
  validateRedirectURLSupported,
  validateSupportedGrantType,
  verifyParametersExistAndOnlyOnce,
} from "./validate-token";

export interface Response {
  statusCode: number;
  body: string;
}

interface OicdPersistedData {
  code: string;
  nonce: string;
}

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertClassInstanceToMap: true,
  },
});
const { OIDC_CLIENT_ID, ENVIRONMENT, TABLE_NAME, JWK_KEY_SECRET } = process.env;
const algorithm = "ES256";
const jwtHeader: JWTHeaderParameters = {
  kid: "B-QMUxdJOJ8ubkmArc4i1SGmfZnNNlM-va9h0HJ0jCo",
  alg: algorithm,
};
const tokenResponseTemplate: Omit<Token, "access_token" | "id_token"> = {
  refresh_token: "456DEF",
  token_type: "Bearer",
  expires_in: 3600,
};
let cachedPrivateKey: Uint8Array | KeyLike;
const getPrivateKey = async () => {
  if (!cachedPrivateKey) {
    if (typeof JWK_KEY_SECRET === "undefined") {
      throw new Error("JWK_KEY_SECRET environment variable is undefined");
    }
    const jwkSecret = JSON.parse(JWK_KEY_SECRET);
    const jwk: JWK = JSON.parse(jwkSecret);
    cachedPrivateKey = await importJWK(jwk, algorithm);
  }
  return cachedPrivateKey;
};
getPrivateKey(); //populate cache on runtime

const epochDateNow = (): number => Math.round(Date.now() / 1000);

const newClaims = (
  oidcClientId: string,
  environment: string,
  randomString: string,
  nonce: string
): JWTPayload => ({
  sub: `urn:fdc:gov.uk:2022:${randomString}`,
  iss: `https://oidc-stub.home.${environment}.account.gov.uk/`,
  aud: oidcClientId,
  exp: epochDateNow() + 3600,
  iat: epochDateNow(),
  sid: uuid(),
  nonce,
  vot: "Cl.Cm",
});

const persistedNonce = async (code: string): Promise<string> => {
  if (typeof TABLE_NAME === "undefined") {
    throw new Error("TABLE_NAME environment variable is undefined");
  }
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      code,
    },
  });
  const results = await dynamoDocClient.send(command);
  if (results.Item === undefined) {
    throw new Error("code not found in DB");
  }
  return (results.Item as OicdPersistedData).nonce;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<Response> => {
  if (!event.body) {
    throw new Error(`no request body is provided`);
  }

  verifyParametersExistAndOnlyOnce(event.body);
  validateRedirectURLSupported(event.body);
  validateSupportedGrantType(event.body);

  const codeStartIndex = event.body.indexOf("&code=") + 6;
  const codeEndIndex = event.body.indexOf("&redirect_uri=");
  const code = event.body.substring(codeStartIndex, codeEndIndex);

  const nonce = await persistedNonce(code);

  if (
    typeof OIDC_CLIENT_ID === "undefined" ||
    typeof ENVIRONMENT === "undefined"
  ) {
    throw new Error(
      `an environment variable is undefined OIDC_CLIENT_ID: ${OIDC_CLIENT_ID} or ENVIRONMENT: ${ENVIRONMENT}`
    );
  }

  validateClientIdMatches(event.body, OIDC_CLIENT_ID);

  const privateKey = await getPrivateKey(); // Retrieve cached private key
  const jwt = await new SignJWT(
    newClaims(OIDC_CLIENT_ID, ENVIRONMENT, uuid(), nonce)
  )
    .setProtectedHeader(jwtHeader)
    .sign(privateKey);

  const tokenResponse: Token = {
    ...tokenResponseTemplate,
    access_token: jwt,
    id_token: jwt,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(tokenResponse),
  };
};
