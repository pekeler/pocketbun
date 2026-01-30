export type TrustedProxyConfig = {
  headers: string[];
  useLeftmostIP: boolean;
};

export class Settings {
  trustedProxy: TrustedProxyConfig;

  constructor() {
    this.trustedProxy = {
      headers: [],
      useLeftmostIP: false,
    };
  }
}
