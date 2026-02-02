// Ported from pocketbase/plugins/ghupdate/ghupdate.go
// Note: PocketBun is library-only, so the CLI/update command is not ported.

export function compareVersions(a: string, b: string): number {
  const aSplit = a.split(".");
  const bSplit = b.split(".");

  const limit = Math.max(aSplit.length, bSplit.length);

  for (let i = 0; i < limit; i += 1) {
    let x = 0;
    let y = 0;

    if (i < aSplit.length) {
      const parsed = Number.parseInt(aSplit[i] ?? "", 10);
      x = Number.isFinite(parsed) ? parsed : 0;
    }

    if (i < bSplit.length) {
      const parsed = Number.parseInt(bSplit[i] ?? "", 10);
      y = Number.isFinite(parsed) ? parsed : 0;
    }

    if (x < y) {
      return 1; // b is newer
    }

    if (x > y) {
      return -1; // a is newer
    }
  }

  return 0; // equal
}
