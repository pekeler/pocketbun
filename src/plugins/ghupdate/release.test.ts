// Ported from pocketbase/plugins/ghupdate/release_test.go

import { describe, it } from "bun:test";
import { Release } from "./release.ts";

describe("ghupdate release", () => {
  it("findAssetBySuffix", () => {
    const release = new Release();
    release.Assets = [
      { Name: "test1.zip", Id: 1, DownloadUrl: "", Size: 0 },
      { Name: "test2.zip", Id: 2, DownloadUrl: "", Size: 0 },
      { Name: "test22.zip", Id: 22, DownloadUrl: "", Size: 0 },
      { Name: "test3.zip", Id: 3, DownloadUrl: "", Size: 0 },
    ];

    const asset = release.findAssetBySuffix("2.zip");
    if (asset.Id !== 2) {
      throw new Error(`Expected asset with id 2, got ${JSON.stringify(asset)}`);
    }
  });
});
