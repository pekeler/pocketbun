// Ported from golang.org/x/oauth2 auth code options (minimal helpers).

export type AuthCodeOption = {
  key: string;
  value: string;
};

export function SetAuthURLParam(key: string, value: string): AuthCodeOption {
  return { key, value };
}

export const AccessTypeOffline = SetAuthURLParam("access_type", "offline");
export const ApprovalForce = SetAuthURLParam("prompt", "consent");
