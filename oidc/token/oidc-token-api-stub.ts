import { v4 as uuid } from "uuid";
import { JWTHeaderParameters, JWTPayload } from "jose";
import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { TokenResponse } from "./models";

const encryptionAlgorithm = "ES256";
const issuer = "https://oidc-stub.home.account.gov.uk/";

export interface Response {
  statusCode: number;
  body: string;
}

const epochDateNow = (): number => Math.round(Date.now() / 1000);

const newClaims = (
  oidcClientId: string,
  environment: string,
  randomString: string
): JWTPayload => ({
  sub: `urn:fdc:gov.uk:2022:${randomString}`,
  iss: `https://oidc-stub.home.${environment}.account.gov.uk/`,
  aud: oidcClientId,
  exp: epochDateNow() + 3600,
  iat: epochDateNow(),
  sid: uuid(),
});

const newJwtHeader = (keyId: string): JWTHeaderParameters => ({
  kid: keyId,
  alg: encryptionAlgorithm,
});

const signJwtViaKms = async (
  header: JWTHeaderParameters,
  payload: JWTPayload,
  keyId: string
): Promise<string> => {
  const kmsClient = new KMSClient({});
  const jwtParts = {
    header: Buffer.from(JSON.stringify(header)).toString("base64url"),
    payload: Buffer.from(JSON.stringify(payload)).toString("base64url"),
    signature: "",
  };
  const message = Buffer.from(`${jwtParts.header}.${jwtParts.payload}`);
  const signCommand = new SignCommand({
    Message: message,
    MessageType: "RAW",
    KeyId: keyId,
    SigningAlgorithm: "ECDSA_SHA_256",
  });
  const response = await kmsClient.send(signCommand);
  if (!response.Signature) {
    throw new Error(`Failed to sign JWT with KMS key ${keyId}`);
  }
  jwtParts.signature = Buffer.from(response.Signature).toString("base64url");
  return `${jwtParts.header}.${jwtParts.payload}.${jwtParts.signature}`;
};

export const handler = async (): Promise<Response> => {
  const { OIDC_CLIENT_ID } = process.env;
  const { SIGNING_KEY_ID } = process.env;
  const { ENVIRONMENT } = process.env;

  if (
    typeof OIDC_CLIENT_ID === "undefined" ||
    typeof SIGNING_KEY_ID === "undefined" ||
    typeof ENVIRONMENT === "undefined"
  ) {
    throw new Error(
      `variable OIDC_CLIENT_ID ${OIDC_CLIENT_ID} or SIGNING_KEY_ID ${SIGNING_KEY_ID}
       or ENVIRONMENT ${ENVIRONMENT} is undefined`
    );
  }

  const signedJwt = await signJwtViaKms(
    newJwtHeader(SIGNING_KEY_ID),
    newClaims(OIDC_CLIENT_ID, ENVIRONMENT, uuid()),
    SIGNING_KEY_ID
  );

  console.log(signedJwt);

  const tokenResponse = (): TokenResponse => ({
    access_token: "123ABC",
    refresh_token: "456DEF",
    token_type: "Bearer",
    expires_in: 3600,
    id_token: signedJwt,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(tokenResponse()),
  };
};
