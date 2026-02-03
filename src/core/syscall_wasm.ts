// Ported from pocketbase/core/syscall_wasm.go

// https://github.com/pocketbase/pocketbase/pull/7116
export function execve(_argv0: string, _argv: string[], _envv: string[]): Error {
  return new Error("execve is not supported by Bun");
}
