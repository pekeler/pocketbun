// Ported from pocketbase/tools/osutils/cmd.go

import { platform } from "node:os";

function validateURL(url: string): Error | null {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol) {
      return new Error("invalid url");
    }
  } catch {
    return new Error("invalid url");
  }

  return null;
}

// LaunchURL attempts to open the provided url in the user's default browser.
//
// It is platform dependent and it uses:
//   - "open" on macOS
//   - "rundll32" on Windows
//   - "xdg-open" on everything else (Linux, FreeBSD, etc.)
export function LaunchURL(url: string): Error | null {
  const err = validateURL(url);
  if (err) {
    return err;
  }

  let cmd = "xdg-open";
  let args = [url];

  switch (platform()) {
    case "darwin":
      cmd = "open";
      args = [url];
      break;
    case "win32":
      // not sure if this is the best command but seems to be the most reliable based on the comments in
      // https://stackoverflow.com/questions/3739327/launching-a-website-via-the-windows-commandline#answer-49115945
      cmd = "rundll32";
      args = ["url.dll,FileProtocolHandler", url];
      break;
    default:
      cmd = "xdg-open";
      args = [url];
      break;
  }

  try {
    const proc = Bun.spawn({
      cmd: [cmd, ...args],
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.unref?.();
    return null;
  } catch (error) {
    return error as Error;
  }
}

// YesNoPrompt performs a console prompt that asks the user for Yes/No answer.
//
// If the user just press Enter (aka. doesn't type anything) it returns the fallback value.
export function YesNoPrompt(message: string, fallback: boolean): boolean {
  let options = "Y/n";
  if (!fallback) {
    options = "y/N";
  }

  // Bun provides a sync prompt() helper, which keeps this function sync like the Go version.
  while (true) {
    process.stderr.write(`${message} (${options}) `);
    const raw = (globalThis.prompt?.("") ?? "").trim().toLowerCase();

    switch (raw) {
      case "":
        return fallback;
      case "y":
      case "yes":
        return true;
      case "n":
      case "no":
        return false;
      default:
        break;
    }
  }
}
