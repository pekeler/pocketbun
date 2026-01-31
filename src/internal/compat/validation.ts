// PocketBun-only: minimal validation helpers to replace ozzo-validation primitives.

export class ValidationError extends Error {
  code: string;
  params: Record<string, unknown> | null;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.params = null;
  }

  setParams(params: Record<string, unknown>): this {
    this.params = params;
    return this;
  }
}

export function newError(code: string, message: string): ValidationError {
  return new ValidationError(code, message);
}

export const ErrRequired = newError("validation_required", "Cannot be blank.");

export function required(value: unknown): ValidationError | null {
  if (value == null) {
    return ErrRequired;
  }
  if (typeof value === "string" && value.length === 0) {
    return ErrRequired;
  }
  if (typeof value === "boolean") {
    return value ? null : ErrRequired;
  }
  if (typeof value === "number") {
    return value === 0 ? ErrRequired : null;
  }
  if (typeof value === "bigint") {
    return value === 0n ? ErrRequired : null;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? ErrRequired : null;
  }
  if (typeof value === "object") {
    const candidate = value as {
      isZero?: () => boolean;
      IsZero?: () => boolean;
      length?: number;
      size?: number;
    };
    if (typeof candidate.isZero === "function" && candidate.isZero()) {
      return ErrRequired;
    }
    if (typeof candidate.IsZero === "function" && candidate.IsZero()) {
      return ErrRequired;
    }
    if (typeof candidate.length === "number") {
      return candidate.length === 0 ? ErrRequired : null;
    }
    if (typeof candidate.size === "number") {
      return candidate.size === 0 ? ErrRequired : null;
    }
  }
  return null;
}

export class ValidationErrors extends Error {
  errors: Record<string, Error>;

  constructor(errors: Record<string, Error> = {}) {
    super(formatValidationErrors(errors));
    this.errors = errors;
  }
}

function formatValidationErrors(errors: Record<string, Error>): string {
  const keys = Object.keys(errors).sort();
  if (keys.length === 0) {
    return "";
  }

  const parts = keys.map((key) => {
    const err = errors[key];
    const message = err instanceof Error ? err.message : String(err);
    const trimmed = message.endsWith(".") ? message.slice(0, -1) : message;
    return `${key}: ${trimmed}`;
  });

  return `${parts.join("; ")}.`;
}

export function isEmptyValue(value: unknown): boolean {
  return required(value) !== null;
}
