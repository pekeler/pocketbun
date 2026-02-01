// Ported from pocketbase/apis/record_auth_methods.go

import type { App } from "../core/app.ts";
import type { OAuth2ProviderConfig } from "../core/collection_model_auth_options.ts";
import type { RequestEvent } from "../core/event_request.ts";
import type { AuthCodeOption } from "../tools/auth/oauth2.ts";
import { NameApple } from "../tools/auth/apple.ts";
import { SetAuthURLParam } from "../tools/auth/oauth2.ts";
import { S256Challenge } from "../tools/security/crypto.ts";
import { randomString } from "../tools/security/random.ts";
import { authCollectionNotFound, findAuthCollection } from "./record_auth_utils.ts";

type OTPResponse = {
  enabled: boolean;
  duration: number;
};

type MFAResponse = {
  enabled: boolean;
  duration: number;
};

type PasswordResponse = {
  identityFields: string[];
  enabled: boolean;
};

type ProviderInfo = {
  name: string;
  displayName: string;
  state: string;
  authURL: string;
  authUrl: string;
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

type OAuth2Response = {
  providers: ProviderInfo[];
  enabled: boolean;
};

type AuthMethodsResponse = {
  password: PasswordResponse;
  oauth2: OAuth2Response;
  mfa: MFAResponse;
  otp: OTPResponse;
  authProviders: ProviderInfo[];
  usernamePassword: boolean;
  emailPassword: boolean;
};

export async function recordAuthMethods(app: App, event: RequestEvent): Promise<Response> {
  const collection = findAuthCollection(app, event);
  if (!collection) {
    return authCollectionNotFound(event);
  }

  const result: AuthMethodsResponse = {
    password: {
      identityFields: [],
      enabled: false,
    },
    oauth2: {
      providers: [],
      enabled: false,
    },
    otp: {
      enabled: collection.OTP.Enabled,
      duration: collection.OTP.Enabled ? collection.OTP.Duration : 0,
    },
    mfa: {
      enabled: collection.MFA.Enabled,
      duration: collection.MFA.Enabled ? collection.MFA.Duration : 0,
    },
    authProviders: [],
    usernamePassword: false,
    emailPassword: false,
  };

  if (collection.PasswordAuth.Enabled) {
    result.password.enabled = true;
    result.password.identityFields = [...(collection.PasswordAuth.IdentityFields ?? [])];
  }

  if (!collection.OAuth2.Enabled) {
    fillLegacyFields(result);
    return event.json(200, result);
  }

  result.oauth2.enabled = true;

  for (const config of collection.OAuth2.Providers ?? []) {
    const info = buildProviderInfo(config);
    if (!info) {
      continue;
    }
    result.oauth2.providers.push(info);
  }

  fillLegacyFields(result);

  return event.json(200, result);
}

function buildProviderInfo(config: OAuth2ProviderConfig): ProviderInfo | null {
  const { provider, error } = config.InitProvider();
  if (error || !provider) {
    return null;
  }

  const info: ProviderInfo = {
    name: config.Name,
    displayName: provider.DisplayName() || config.Name,
    state: randomString(30),
    authURL: "",
    authUrl: "",
    codeVerifier: "",
    codeChallenge: "",
    codeChallengeMethod: "",
  };

  const urlOpts: AuthCodeOption[] = [];
  if (config.Name === NameApple) {
    urlOpts.push(SetAuthURLParam("response_mode", "form_post"));
  }

  if (provider.PKCE()) {
    info.codeVerifier = randomString(43);
    info.codeChallenge = S256Challenge(info.codeVerifier);
    info.codeChallengeMethod = "S256";
    urlOpts.push(
      SetAuthURLParam("code_challenge", info.codeChallenge),
      SetAuthURLParam("code_challenge_method", info.codeChallengeMethod),
    );
  }

  info.authURL = `${provider.BuildAuthURL(info.state, ...urlOpts)}&redirect_uri=`;
  info.authUrl = info.authURL;

  return info;
}

function fillLegacyFields(result: AuthMethodsResponse): void {
  result.emailPassword = result.password.enabled && result.password.identityFields.includes("email");
  result.usernamePassword = result.password.enabled && result.password.identityFields.includes("username");
  if (result.oauth2.enabled) {
    result.authProviders = result.oauth2.providers;
  }
}
