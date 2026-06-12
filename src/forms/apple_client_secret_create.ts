// Ported from pocketbase/forms/apple_client_secret_create.go

import { createPrivateKey, sign } from "node:crypto";
import type { App } from "../core/app.ts";
import { ValidationErrors, newError, required } from "../internal/compat/validation.ts";

const privateKeyRegex = /-----BEGIN PRIVATE KEY----[\s\S]+-----END PRIVATE KEY-----/m;

// AppleClientSecretCreate is a form struct to generate a new Apple Client Secret.
//
// Reference: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
export class AppleClientSecretCreate {
  app: App;

  ClientId = "";
  TeamId = "";
  KeyId = "";
  PrivateKey = "";
  Duration = 0;

  constructor(app: App) {
    this.app = app;
  }

  get clientId(): string {
    return this.ClientId;
  }

  set clientId(value: string) {
    this.ClientId = value;
  }

  get teamId(): string {
    return this.TeamId;
  }

  set teamId(value: string) {
    this.TeamId = value;
  }

  get keyId(): string {
    return this.KeyId;
  }

  set keyId(value: string) {
    this.KeyId = value;
  }

  get privateKey(): string {
    return this.PrivateKey;
  }

  set privateKey(value: string) {
    this.PrivateKey = value;
  }

  get duration(): number {
    return this.Duration;
  }

  set duration(value: number) {
    this.Duration = value;
  }

  // Validate makes the form validatable by implementing [validation.Validatable] interface.
  Validate(): Error | null {
    const errors: Record<string, Error> = {};

    const clientIdErr = required(this.ClientId);
    if (clientIdErr) {
      errors.clientId = clientIdErr;
    }

    const teamIdErr = required(this.TeamId);
    if (teamIdErr) {
      errors.teamId = teamIdErr;
    } else if (this.TeamId.length !== 10) {
      errors.teamId = newError("validation_length_invalid", "The length must be 10.");
    }

    const keyIdErr = required(this.KeyId);
    if (keyIdErr) {
      errors.keyId = keyIdErr;
    } else if (this.KeyId.length !== 10) {
      errors.keyId = newError("validation_length_invalid", "The length must be 10.");
    }

    const privateKeyErr = required(this.PrivateKey);
    if (privateKeyErr) {
      errors.privateKey = privateKeyErr;
    } else if (!privateKeyRegex.test(this.PrivateKey)) {
      errors.privateKey = newError("validation_match_invalid", "Must be in a valid format.");
    }

    const durationErr = required(this.Duration);
    if (durationErr) {
      errors.duration = durationErr;
    } else if (!Number.isFinite(this.Duration) || this.Duration < 1) {
      errors.duration = newError("validation_min_greater_equal_than_required", "Must be greater or equal to 1.");
    } else if (this.Duration > 15777000) {
      errors.duration = newError("validation_max", "Must be less than or equal to 15777000.");
    }

    return Object.keys(errors).length > 0 ? new ValidationErrors(errors) : null;
  }

  // PocketBun JSVM compatibility: PocketBase exposes lower-camel form APIs
  // that throw validation errors instead of returning Go-style error values.
  validate(): void {
    const err = this.Validate();
    if (err) {
      throw err;
    }
  }

  // Submit validates the form and returns a new Apple Client Secret JWT.
  Submit(): { secret: string; error: Error | null } {
    const err = this.Validate();
    if (err) {
      return { secret: "", error: err };
    }

    let signKey: ReturnType<typeof createPrivateKey>;
    try {
      signKey = createPrivateKey({ key: this.PrivateKey.trim(), format: "pem" });
    } catch (error) {
      return { secret: "", error: error as Error };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const claims = {
      aud: ["https://appleid.apple.com"],
      sub: this.ClientId,
      iss: this.TeamId,
      iat: nowSeconds,
      exp: nowSeconds + this.Duration,
    };

    const header = { alg: "ES256", kid: this.KeyId };
    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;

    let signature: Buffer;
    try {
      signature = sign("SHA256", Buffer.from(signingInput), { key: signKey, dsaEncoding: "ieee-p1363" });
    } catch (error) {
      return { secret: "", error: error as Error };
    }

    const secret = `${signingInput}.${base64UrlEncode(signature)}`;
    return { secret, error: null };
  }

  submit(): string {
    const { secret, error } = this.Submit();
    if (error) {
      throw error;
    }
    return secret;
  }
}

// NewAppleClientSecretCreate creates a new [AppleClientSecretCreate] form with initializer
// config created from the provided [core.App] instances.
export function NewAppleClientSecretCreate(app: App): AppleClientSecretCreate {
  return new AppleClientSecretCreate(app);
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
