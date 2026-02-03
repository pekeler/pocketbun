// Ported from pocketbase/core/syscall.go

// execve invokes the execve(2) system call.
export function execve(_argv0: string, _argv: string[], _envv: string[]): Error {
  // Deviation: Bun doesn't expose execve for the current process, so this is a stub.
  return new Error("execve is not supported by Bun");
}
