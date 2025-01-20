export interface Response {
  statusCode: number;
  body: string;
}

const { ENVIRONMENT } = process.env;

export const handler = async () => {
  const configurationData = {
    authorization_endpoint: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/authorize`,
    token_endpoint: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/token`,
    registration_endpoint: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/connect/register`,
    issuer: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/`,
    jwks_uri: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/.well-known/jwks.json`,
    scopes_supported: ["openid", "email", "phone", "offline_access"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
    token_endpoint_auth_signing_alg_values_supported: [
      "RS256",
      "RS384",
      "RS512",
      "PS256",
      "PS384",
      "PS512",
    ],
    ui_locales_supported: ["en", "cy"],
    service_documentation: "https://unsuported-by-stub.gov.uk/",
    op_policy_uri: "https://unsuported-by-stub.gov.uk/",
    op_tos_uri: "https://unsuported-by-stub.gov.uk/",
    request_uri_parameter_supported: true,
    trustmarks: "https://unsuported-by-stub.gov.uk/",
    subject_types_supported: ["public", "pairwise"],
    userinfo_endpoint: `https://oidc-stub.home.${ENVIRONMENT}.account.gov.uk/userinfo`,
    end_session_endpoint: "https://signin.build.account.gov.uk/signed-out",
    id_token_signing_alg_values_supported: ["ES256", "RS256"],
    claim_types_supported: ["normal"],
    claims_supported: [
      "sub",
      "email",
      "email_verified",
      "phone_number",
      "phone_number_verified",
      "https://vocab.account.gov.uk/v1/passport",
      "https://vocab.account.gov.uk/v1/drivingPermit",
      "https://vocab.account.gov.uk/v1/coreIdentityJWT",
      "https://vocab.account.gov.uk/v1/address",
    ],
    backchannel_logout_supported: true,
    backchannel_logout_session_supported: false,
  };

  const response = {
    statusCode: 200,
    body: JSON.stringify(configurationData),
  };

  return response;
};
