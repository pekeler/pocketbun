// Ported from pocketbase/plugins/ghupdate/release_test.go

import { describe, expect, it } from "bun:test";
import { Release, ReleaseAsset } from "./release.ts";

describe("Release.findAssetBySuffix", () => {
  it("returns the first matching asset", () => {
    const release = new Release();
    release.Assets = [
      Object.assign(new ReleaseAsset(), { Name: "test1.zip", Id: 1 }),
      Object.assign(new ReleaseAsset(), { Name: "test2.zip", Id: 2 }),
      Object.assign(new ReleaseAsset(), { Name: "test22.zip", Id: 22 }),
      Object.assign(new ReleaseAsset(), { Name: "test3.zip", Id: 3 }),
    ];

    const asset = release.findAssetBySuffix("2.zip");
    expect(asset.Id).toBe(2);
  });
});
