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

  loadFromJSON(value: unknown): void {
    if (!value || typeof value !== "object") {
      return;
    }

    const trustedProxy = (value as Record<string, unknown>).trustedProxy;
    if (trustedProxy && typeof trustedProxy === "object") {
      const headers = (trustedProxy as Record<string, unknown>).headers;
      if (Array.isArray(headers)) {
        this.trustedProxy.headers = headers.filter((entry) => typeof entry === "string");
      }

      const useLeftmostIP = (trustedProxy as Record<string, unknown>).useLeftmostIP;
      if (typeof useLeftmostIP === "boolean") {
        this.trustedProxy.useLeftmostIP = useLeftmostIP;
      }
    }
  }
}
