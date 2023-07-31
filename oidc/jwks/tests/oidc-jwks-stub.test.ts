import { Response, handler } from "../oidc-jwks-stub";

describe("handler", () => {
  test("returns jwks data", async () => {
    const result: Response = await handler();
    expect(result.statusCode).toEqual(200);
    expect(result.body).toContain('"kty":"EC"');
  });
});
