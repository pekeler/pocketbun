// Ported from pocketbase/tools/auth (barrel exports).

export { Providers, newProviderByName, wrapFactory, type Provider, type ProviderFactoryFunc } from "./auth.ts";
export { BaseProvider } from "./base_provider.ts";
export { Gitlab, NameGitlab } from "./gitlab.ts";
export { Google, NameGoogle } from "./google.ts";
export { Github, NameGithub } from "./github.ts";
