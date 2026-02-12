// Ported from pocketbase/plugins/ghupdate/release.go

type JsonMap = Record<string, unknown>;

export class ReleaseAsset {
  Name = "";
  DownloadUrl = "";
  Id = 0;
  Size = 0;

  static fromJson(data: unknown): ReleaseAsset {
    const source = asJsonMap(data);
    const asset = new ReleaseAsset();
    asset.Name = asString(source.name);
    asset.DownloadUrl = asString(source.browser_download_url);
    asset.Id = asNumber(source.id);
    asset.Size = asNumber(source.size);
    return asset;
  }
}

export class Release {
  Name = "";
  Tag = "";
  Published = "";
  Url = "";
  Body = "";
  Assets: ReleaseAsset[] = [];
  Id = 0;

  static fromJson(data: unknown): Release {
    const source = asJsonMap(data);
    const release = new Release();
    release.Name = asString(source.name);
    release.Tag = asString(source.tag_name);
    release.Published = asString(source.published_at);
    release.Url = asString(source.html_url);
    release.Body = asString(source.body);
    release.Id = asNumber(source.id);

    const assets = Array.isArray(source.assets) ? source.assets : [];
    release.Assets = assets.map((asset) => ReleaseAsset.fromJson(asset));
    return release;
  }

  // findAssetBySuffix returns the first available asset containing the specified suffix.
  findAssetBySuffix(suffix: string): ReleaseAsset {
    if (suffix !== "") {
      for (const asset of this.Assets) {
        if (asset.Name.endsWith(suffix)) {
          return asset;
        }
      }
    }

    throw new Error(`missing asset containing ${suffix}`);
  }
}

function asJsonMap(value: unknown): JsonMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonMap;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
