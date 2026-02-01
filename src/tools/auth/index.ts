// Ported from pocketbase/tools/auth (barrel exports).

export {
  Providers,
  newProviderByName,
  wrapFactory,
  AuthUser,
  type OAuth2Token,
  type Provider,
  type ProviderFactoryFunc,
} from "./auth.ts";
export { BaseProvider } from "./base_provider.ts";
export { Apple, NameApple } from "./apple.ts";
export { Bitbucket, NameBitbucket } from "./bitbucket.ts";
export { Box, NameBox } from "./box.ts";
export { Discord, NameDiscord } from "./discord.ts";
export { Facebook, NameFacebook } from "./facebook.ts";
export { Gitea, NameGitea } from "./gitea.ts";
export { Gitee, NameGitee } from "./gitee.ts";
export { Gitlab, NameGitlab } from "./gitlab.ts";
export { Google, NameGoogle } from "./google.ts";
export { Github, NameGithub } from "./github.ts";
export { Instagram, NameInstagram } from "./instagram.ts";
export { Kakao, NameKakao } from "./kakao.ts";
export { Lark, NameLark } from "./lark.ts";
export { Linear, NameLinear } from "./linear.ts";
export { Livechat, NameLivechat } from "./livechat.ts";
export { Mailcow, NameMailcow } from "./mailcow.ts";
export { Microsoft, NameMicrosoft } from "./microsoft.ts";
export { Monday, NameMonday } from "./monday.ts";
export { Notion, NameNotion } from "./notion.ts";
export { OIDC, NameOIDC } from "./oidc.ts";
export { Patreon, NamePatreon } from "./patreon.ts";
export { Planningcenter, NamePlanningcenter } from "./planningcenter.ts";
export { Spotify, NameSpotify } from "./spotify.ts";
export { Strava, NameStrava } from "./strava.ts";
export { Trakt, NameTrakt } from "./trakt.ts";
export { Twitch, NameTwitch } from "./twitch.ts";
export { Twitter, NameTwitter } from "./twitter.ts";
export { VK, NameVK } from "./vk.ts";
export { Wakatime, NameWakatime } from "./wakatime.ts";
export { Yandex, NameYandex } from "./yandex.ts";
