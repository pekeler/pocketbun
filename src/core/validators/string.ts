// Ported from pocketbase/core/validators/string.go

import { isIPOrSubnet } from "../../internal/compat/ip.ts";
import { newError } from "../../internal/compat/validation.ts";
import { ErrUnsupportedValueType } from "./validators.ts";

export function isRegex(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value === "") {
    return null;
  }
  try {
    new RegExp(value);
  } catch (error) {
    return newError("validation_invalid_regex", (error as Error).message);
  }
  return null;
}

// IPOrSubnet checks whether the validated value is an individual
// IPv4/IPv6 or CIDR subnet.
export function IPOrSubnet(value: unknown): Error | null {
  if (typeof value !== "string") {
    return ErrUnsupportedValueType;
  }
  if (value === "") {
    return null;
  }
  if (!isIPOrSubnet(value)) {
    return newError("validation_invlaid_ip_or_subnet", "invalid IP or CIDR subnet");
  }
  return null;
}
