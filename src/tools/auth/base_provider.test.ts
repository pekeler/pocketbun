// Ported from pocketbase/tools/auth/base_provider_test.go

import { describe, it } from "bun:test";
import { BaseProvider } from "./base_provider.ts";
import { AccessTypeOffline, ApprovalForce } from "./oauth2.ts";

describe("auth base provider", () => {
  it("Context", () => {
    const provider = new BaseProvider();

    const before = provider.Scopes();
    if (before !== null) {
      throw new Error(`Expected nil context, got ${JSON.stringify(before)}`);
    }

    provider.SetContext({});

    const after = provider.Scopes();
    if (after !== null) {
      throw new Error("Expected non-nil context");
    }
  });

  it("DisplayName", () => {
    const provider = new BaseProvider();

    if (provider.DisplayName() !== "") {
      throw new Error(`Expected displayName to be empty, got ${provider.DisplayName()}`);
    }

    provider.SetDisplayName("test");

    if (provider.DisplayName() !== "test") {
      throw new Error(`Expected displayName to be 'test', got ${provider.DisplayName()}`);
    }
  });

  it("PKCE", () => {
    const provider = new BaseProvider();

    if (provider.PKCE() !== false) {
      throw new Error(`Expected pkce to be false, got ${provider.PKCE()}`);
    }

    provider.SetPKCE(true);

    if (provider.PKCE() !== true) {
      throw new Error(`Expected pkce to be true, got ${provider.PKCE()}`);
    }
  });

  it("Scopes", () => {
    const provider = new BaseProvider();

    const before = provider.Scopes();
    if ((before?.length ?? 0) !== 0) {
      throw new Error(`Expected 0 scopes, got ${JSON.stringify(before)}`);
    }

    provider.SetScopes(["test1", "test2"]);

    const after = provider.Scopes();
    if ((after?.length ?? 0) !== 2) {
      throw new Error(`Expected 2 scopes, got ${JSON.stringify(after)}`);
    }
  });

  it("ClientId", () => {
    const provider = new BaseProvider();

    if (provider.ClientId() !== "") {
      throw new Error(`Expected clientId to be empty, got ${provider.ClientId()}`);
    }

    provider.SetClientId("test");

    if (provider.ClientId() !== "test") {
      throw new Error(`Expected clientId to be 'test', got ${provider.ClientId()}`);
    }
  });

  it("ClientSecret", () => {
    const provider = new BaseProvider();

    if (provider.ClientSecret() !== "") {
      throw new Error(`Expected clientSecret to be empty, got ${provider.ClientSecret()}`);
    }

    provider.SetClientSecret("test");

    if (provider.ClientSecret() !== "test") {
      throw new Error(`Expected clientSecret to be 'test', got ${provider.ClientSecret()}`);
    }
  });

  it("RedirectURL", () => {
    const provider = new BaseProvider();

    if (provider.RedirectURL() !== "") {
      throw new Error(`Expected RedirectURL to be empty, got ${provider.RedirectURL()}`);
    }

    provider.SetRedirectURL("test");

    if (provider.RedirectURL() !== "test") {
      throw new Error(`Expected RedirectURL to be 'test', got ${provider.RedirectURL()}`);
    }
  });

  it("AuthURL", () => {
    const provider = new BaseProvider();

    if (provider.AuthURL() !== "") {
      throw new Error(`Expected authURL to be empty, got ${provider.AuthURL()}`);
    }

    provider.SetAuthURL("test");

    if (provider.AuthURL() !== "test") {
      throw new Error(`Expected authURL to be 'test', got ${provider.AuthURL()}`);
    }
  });

  it("TokenURL", () => {
    const provider = new BaseProvider();

    if (provider.TokenURL() !== "") {
      throw new Error(`Expected tokenURL to be empty, got ${provider.TokenURL()}`);
    }

    provider.SetTokenURL("test");

    if (provider.TokenURL() !== "test") {
      throw new Error(`Expected tokenURL to be 'test', got ${provider.TokenURL()}`);
    }
  });

  it("UserInfoURL", () => {
    const provider = new BaseProvider();

    if (provider.UserInfoURL() !== "") {
      throw new Error(`Expected userInfoURL to be empty, got ${provider.UserInfoURL()}`);
    }

    provider.SetUserInfoURL("test");

    if (provider.UserInfoURL() !== "test") {
      throw new Error(`Expected userInfoURL to be 'test', got ${provider.UserInfoURL()}`);
    }
  });

  it("Extra", () => {
    const provider = new BaseProvider();

    const before = provider.Extra();
    if (before !== null) {
      throw new Error(`Expected extra to be empty, got ${JSON.stringify(before)}`);
    }

    const extra = { a: 1, b: 2 };
    provider.SetExtra(extra);

    const after = provider.Extra();
    if (!after) {
      throw new Error("Expected extra to be populated");
    }
    const rawExtra = JSON.stringify(extra);
    const rawAfter = JSON.stringify(after);
    if (rawExtra !== rawAfter) {
      throw new Error(`Expected extra to be ${rawExtra}, got ${rawAfter}`);
    }

    after.b = 3;
    const finalExtra = provider.Extra();
    if (!finalExtra || finalExtra.b !== 2) {
      throw new Error(`Expected extra to remain unchanged, got ${JSON.stringify(finalExtra)}`);
    }
  });

  it("BuildAuthURL", () => {
    const provider = new BaseProvider();
    provider.SetAuthURL("authURL_test");
    provider.SetTokenURL("tokenURL_test");
    provider.SetRedirectURL("redirectURL_test");
    provider.SetClientId("clientId_test");
    provider.SetClientSecret("clientSecret_test");
    provider.SetScopes(["test_scope"]);

    const expected =
      "authURL_test?access_type=offline&client_id=clientId_test&prompt=consent&redirect_uri=redirectURL_test&response_type=code&scope=test_scope&state=state_test";
    const result = provider.BuildAuthURL("state_test", AccessTypeOffline, ApprovalForce);

    if (result !== expected) {
      throw new Error(`Expected auth url ${expected}, got ${result}`);
    }
  });

  it("Client", () => {
    const provider = new BaseProvider();

    const result = provider.Client(null);
    if (!result) {
      throw new Error("Expected client instance, got null");
    }
  });

  it("oauth2Config", () => {
    const provider = new BaseProvider();
    provider.SetAuthURL("authURL_test");
    provider.SetTokenURL("tokenURL_test");
    provider.SetRedirectURL("redirectURL_test");
    provider.SetClientId("clientId_test");
    provider.SetClientSecret("clientSecret_test");
    provider.SetScopes(["test"]);

    const config = (provider as unknown as { oauth2Config: () => any }).oauth2Config();

    if (config.RedirectURL !== provider.RedirectURL()) {
      throw new Error(`Expected redirectURL ${provider.RedirectURL()}, got ${config.RedirectURL}`);
    }

    if (config.ClientID !== provider.ClientId()) {
      throw new Error(`Expected clientId ${provider.ClientId()}, got ${config.ClientID}`);
    }

    if (config.ClientSecret !== provider.ClientSecret()) {
      throw new Error(`Expected clientSecret ${provider.ClientSecret()}, got ${config.ClientSecret}`);
    }

    if (config.Endpoint.AuthURL !== provider.AuthURL()) {
      throw new Error(`Expected authURL ${provider.AuthURL()}, got ${config.Endpoint.AuthURL}`);
    }

    if (config.Endpoint.TokenURL !== provider.TokenURL()) {
      throw new Error(`Expected tokenURL ${provider.TokenURL()}, got ${config.Endpoint.TokenURL}`);
    }

    const scopes = provider.Scopes() ?? [];
    if (config.Scopes.length !== scopes.length || config.Scopes[0] !== scopes[0]) {
      throw new Error(`Expected scopes ${JSON.stringify(scopes)}, got ${JSON.stringify(config.Scopes)}`);
    }
  });
});
