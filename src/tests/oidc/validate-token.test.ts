import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import {
  validateClientIdMatches,
  validateRedirectURLSupported,
  validateSupportedGrantType,
  verifyParametersExistAndOnlyOnce,
} from "../../oidc/validate-token";
import { decodeJwt } from "jose";

jest.mock("jose", () => ({
  decodeJwt: jest.fn(),
}));

describe("validation for token", () => {
  const eventBody =
    "client_assertion_type=type&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=xxxxxx";

  beforeEach(() => {
    process.env.OIDC_CLIENT_ID = "12345";
    process.env.ENVIRONMENT = "dev";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should throw if duplicate parameters exist", async () => {
    const withAdditionalParam = "client_assertion_type=xxxsxss&" + eventBody;
    expect(() => verifyParametersExistAndOnlyOnce(withAdditionalParam)).toThrow(
      "Missing parameters or duplicate parameter"
    );
  });

  test("should throw an error if not all expected parameters exist", async () => {
    const withMissingParams =
      "&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=xxxxxx";
    expect(() => verifyParametersExistAndOnlyOnce(withMissingParams)).toThrow(
      "Missing parameters or duplicate parameter"
    );
  });

  test("should ensure invalid redirect URL throws an error", async () => {
    const withInvalidRedirectUrl =
      "&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=xxxxx";
    expect(() => validateRedirectURLSupported(withInvalidRedirectUrl)).toThrow(
      "Invalid grant - Invalid redirect URL"
    );
  });

  test("should ensure dev redirect url works", async () => {
    const withInvalidRedirectUrl =
      "&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=https%3A%2F%2Fhome.dev.account.gov.uk%2Fauth%2Fcallback";
    expect(() =>
      validateRedirectURLSupported(withInvalidRedirectUrl)
    ).not.toThrow("Invalid grant - Invalid redirect URL");
  });

  test("should ensure localhost redirect url works", async () => {
    const withInvalidRedirectUrl =
      "&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=http%3A%2F%2Flocalhost%3A6001%2Fauth%2Fcallback";
    expect(() =>
      validateRedirectURLSupported(withInvalidRedirectUrl)
    ).not.toThrow("Invalid grant - Invalid redirect URL");
  });

  test("should ensure build redirect url works", async () => {
    const withInvalidRedirectUrl =
      "&client_assertion=xxxx&grant_type=authorization_code&code=xxxx&redirect_uri=https%3A%2F%2Fhome.build.account.gov.uk%2Fauth%2Fcallback";
    expect(() =>
      validateRedirectURLSupported(withInvalidRedirectUrl)
    ).not.toThrow("Invalid grant - Invalid redirect URL");
  });

  test("should ensure grant type supported", async () => {
    const withInvalidGrantType =
      "&client_assertion=xxxx&grant_type=xxxxx&code=xxxx&redirect_uri=xxxxx";
    expect(() => validateSupportedGrantType(withInvalidGrantType)).toThrow(
      "Unauthorized Client - unsupported_grant_type"
    );
  });

  test("should ensure client id matches expected", async () => {
    const mockedDecodeJwt = decodeJwt as jest.Mock;
    const mockDecodedToken = { iss: "mockIssuer" };
    mockedDecodeJwt.mockReturnValue(mockDecodedToken);
    const withNonMatchingClientId =
      "&client_assertion=mockToken&grant_type=xxxxx&code=xxxx&redirect_uri=xxxxx";

    expect(() =>
      validateClientIdMatches(withNonMatchingClientId, "invalid issuer")
    ).toThrow("Invalid client");

    expect(mockedDecodeJwt).toHaveBeenCalledWith("mockToken");
  });
});
