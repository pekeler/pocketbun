// Ported from pocketbase/plugins/ghupdate/release.go

export type ReleaseAsset = {
  Name: string;
  DownloadUrl: string;
  Id: number;
  Size: number;
};

export class Release {
  Name = "";
  Tag = "";
  Published = "";
  Url = "";
  Body = "";
  Assets: ReleaseAsset[] = [];
  Id = 0;

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
