// Ported from pocketbase/tools/types/types.go

export function pointer<T>(value: T): T {
  return value;
}

// Pointer is a generic helper that returns val as *T.
export function Pointer<T>(value: T): T {
  return value;
}
