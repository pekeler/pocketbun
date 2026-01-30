// Ported from pocketbase/core/record_tokens.go @ v0.36.1 (9b036fb1)

export const TokenTypeAuth = "auth";
export const TokenTypeFile = "file";
export const TokenTypeVerification = "verification";
export const TokenTypePasswordReset = "passwordReset";
export const TokenTypeEmailChange = "emailChange";

export const TokenClaimId = "id";
export const TokenClaimType = "type";
export const TokenClaimCollectionId = "collectionId";
export const TokenClaimEmail = "email";
export const TokenClaimNewEmail = "newEmail";
export const TokenClaimRefreshable = "refreshable";
