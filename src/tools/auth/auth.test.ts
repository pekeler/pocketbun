// Ported from pocketbase/tools/auth/auth_test.go

import { describe, it } from "bun:test";
import {
  Providers,
  newProviderByName,
  Apple,
  Bitbucket,
  Box,
  Discord,
  Facebook,
  Gitea,
  Gitee,
  Github,
  Gitlab,
  Google,
  Instagram,
  Kakao,
  Lark,
  Linear,
  Livechat,
  Mailcow,
  Microsoft,
  Monday,
  Notion,
  OIDC,
  Patreon,
  Planningcenter,
  Spotify,
  Strava,
  Trakt,
  Twitch,
  Twitter,
  VK,
  Wakatime,
  Yandex,
  NameApple,
  NameBitbucket,
  NameBox,
  NameDiscord,
  NameFacebook,
  NameGitea,
  NameGitee,
  NameGithub,
  NameGitlab,
  NameGoogle,
  NameInstagram,
  NameKakao,
  NameLark,
  NameLinear,
  NameLivechat,
  NameMailcow,
  NameMicrosoft,
  NameMonday,
  NameNotion,
  NameOIDC,
  NamePatreon,
  NamePlanningcenter,
  NameSpotify,
  NameStrava,
  NameTrakt,
  NameTwitch,
  NameTwitter,
  NameVK,
  NameWakatime,
  NameYandex,
} from "./index.ts";

describe("auth providers", () => {
  it("Providers count", () => {
    const expected = 32;
    const total = Object.keys(Providers).length;
    if (total !== expected) {
      throw new Error(`Expected ${expected} providers, got ${total}`);
    }
  });

  it("newProviderByName", () => {
    let threw = false;
    try {
      newProviderByName("invalid");
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected error, got nil");
    }

    const expectProvider = (name: string, ctor: new () => unknown) => {
      const provider = newProviderByName(name);
      if (!(provider instanceof ctor)) {
        throw new Error(`Expected ${name} to be instance of ${ctor.name}`);
      }
    };

    expectProvider(NameGoogle, Google);
    expectProvider(NameFacebook, Facebook);
    expectProvider(NameGithub, Github);
    expectProvider(NameGitlab, Gitlab);
    expectProvider(NameTwitter, Twitter);
    expectProvider(NameDiscord, Discord);
    expectProvider(NameMicrosoft, Microsoft);
    expectProvider(NameSpotify, Spotify);
    expectProvider(NameKakao, Kakao);
    expectProvider(NameTwitch, Twitch);
    expectProvider(NameStrava, Strava);
    expectProvider(NameGitee, Gitee);
    expectProvider(NameLivechat, Livechat);
    expectProvider(NameGitea, Gitea);
    expectProvider(NameOIDC, OIDC);
    expectProvider(NameOIDC + "2", OIDC);
    expectProvider(NameOIDC + "3", OIDC);
    expectProvider(NameApple, Apple);
    expectProvider(NameInstagram, Instagram);
    expectProvider(NameVK, VK);
    expectProvider(NameYandex, Yandex);
    expectProvider(NamePatreon, Patreon);
    expectProvider(NameMailcow, Mailcow);
    expectProvider(NameBitbucket, Bitbucket);
    expectProvider(NamePlanningcenter, Planningcenter);
    expectProvider(NameNotion, Notion);
    expectProvider(NameMonday, Monday);
    expectProvider(NameWakatime, Wakatime);
    expectProvider(NameBox, Box);
    expectProvider(NameLinear, Linear);
    expectProvider(NameTrakt, Trakt);
    expectProvider(NameLark, Lark);
  });
});
