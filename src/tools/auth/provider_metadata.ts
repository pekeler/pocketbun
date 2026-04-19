// PocketBun-only: shared OAuth2 provider order/logo metadata reused to match
// PocketBase v0.37.0 responses without inlining large SVG blobs in source.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ProviderMetadata = {
  order: number;
  logoName: string;
};

const providerMetadataByClassName: Record<string, ProviderMetadata> = {
  Apple: { order: 1, logoName: "apple" },
  Google: { order: 2, logoName: "google" },
  Microsoft: { order: 3, logoName: "microsoft" },
  Yandex: { order: 4, logoName: "yandex" },
  Facebook: { order: 5, logoName: "facebook" },
  Instagram: { order: 6, logoName: "instagram" },
  Github: { order: 7, logoName: "github" },
  Gitlab: { order: 8, logoName: "gitlab" },
  Bitbucket: { order: 9, logoName: "bitbucket" },
  Gitee: { order: 10, logoName: "gitee" },
  Gitea: { order: 11, logoName: "gitea" },
  Discord: { order: 12, logoName: "discord" },
  Twitter: { order: 13, logoName: "twitter" },
  Kakao: { order: 14, logoName: "kakao" },
  VK: { order: 15, logoName: "vk" },
  Linear: { order: 16, logoName: "linear" },
  Notion: { order: 17, logoName: "notion" },
  Monday: { order: 18, logoName: "monday" },
  Lark: { order: 19, logoName: "lark" },
  Box: { order: 20, logoName: "box" },
  Spotify: { order: 21, logoName: "spotify" },
  Trakt: { order: 22, logoName: "trakt" },
  Twitch: { order: 23, logoName: "twitch" },
  Patreon: { order: 24, logoName: "patreon" },
  Strava: { order: 25, logoName: "strava" },
  Wakatime: { order: 26, logoName: "wakatime" },
  Livechat: { order: 27, logoName: "livechat" },
  Mailcow: { order: 28, logoName: "mailcow" },
  Planningcenter: { order: 29, logoName: "planningcenter" },
  OIDC: { order: 99, logoName: "oidc" },
};

const providerAssetsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../vendor/pocketbase-admin-ui/dist/images/oauth2",
);
const logoCache = new Map<string, string>();

export function oauth2ProviderOrder(provider: unknown): number {
  return oauth2ProviderMetadata(provider)?.order ?? 0;
}

export function oauth2ProviderLogo(provider: unknown): string {
  const metadata = oauth2ProviderMetadata(provider);
  if (!metadata) {
    return "";
  }

  const cached = logoCache.get(metadata.logoName);
  if (cached != null) {
    return cached;
  }

  const path = join(providerAssetsDir, `${metadata.logoName}.svg`);
  const raw = existsSync(path) ? readFileSync(path, "utf8").trim() : "";
  logoCache.set(metadata.logoName, raw);
  return raw;
}

function oauth2ProviderMetadata(provider: unknown): ProviderMetadata | null {
  const className = provider?.constructor?.name;
  if (typeof className !== "string" || !className) {
    return null;
  }

  return providerMetadataByClassName[className] ?? null;
}
