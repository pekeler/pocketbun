// PocketBun-only: shared IP/CIDR parsing helpers used where upstream relies on Go's net/netip.

import { isIP } from "node:net";

type ParsedIP = {
  version: 4 | 6;
  bits: 32 | 128;
  value: bigint;
};

export function isIPOrSubnet(value: string): boolean {
  return parseIPOrSubnet(value) !== null;
}

export function isIPInList(ipsOrSubnets: string[], ip: string): boolean {
  if (ipsOrSubnets.length === 0 || ip === "") {
    return false;
  }

  const searchAddr = parseIP(ip);
  if (!searchAddr) {
    return false;
  }

  for (const item of ipsOrSubnets) {
    const parsed = parseIPOrSubnet(item);
    if (!parsed || parsed.addr.version !== searchAddr.version) {
      continue;
    }

    if (parsed.prefixBits === null) {
      if (parsed.addr.value === searchAddr.value) {
        return true;
      }
      continue;
    }

    const hostBits = BigInt(parsed.addr.bits - parsed.prefixBits);
    const mask = ((1n << BigInt(parsed.addr.bits)) - 1n) ^ ((1n << hostBits) - 1n);
    if ((parsed.addr.value & mask) === (searchAddr.value & mask)) {
      return true;
    }
  }

  return false;
}

function parseIPOrSubnet(value: string): { addr: ParsedIP; prefixBits: number | null } | null {
  const slash = value.indexOf("/");
  if (slash === -1) {
    const addr = parseIP(value);
    return addr ? { addr, prefixBits: null } : null;
  }

  const addr = parseIP(value.slice(0, slash));
  if (!addr) {
    return null;
  }

  const prefixRaw = value.slice(slash + 1);
  if (!/^\d+$/.test(prefixRaw)) {
    return null;
  }

  const prefixBits = Number(prefixRaw);
  if (!Number.isInteger(prefixBits) || prefixBits < 0 || prefixBits > addr.bits) {
    return null;
  }

  return { addr, prefixBits };
}

function parseIP(value: string): ParsedIP | null {
  const version = isIP(value);
  if (version === 4) {
    const parts = value.split(".").map((part) => Number(part));
    let out = 0n;
    for (const part of parts) {
      out = (out << 8n) + BigInt(part);
    }
    return { version: 4, bits: 32, value: out };
  }

  if (version === 6) {
    const groups = expandIPv6(value);
    if (!groups) {
      return null;
    }
    let out = 0n;
    for (const group of groups) {
      out = (out << 16n) + BigInt(group);
    }
    return { version: 6, bits: 128, value: out };
  }

  return null;
}

function expandIPv6(input: string): number[] | null {
  let value = input.toLowerCase();
  const lastColon = value.lastIndexOf(":");
  const maybeIPv4 = lastColon === -1 ? "" : value.slice(lastColon + 1);
  if (maybeIPv4.includes(".")) {
    const v4 = parseIP(maybeIPv4);
    if (!v4 || v4.version !== 4) {
      return null;
    }
    const high = Number((v4.value >> 16n) & 0xffffn).toString(16);
    const low = Number(v4.value & 0xffffn).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) {
    return null;
  }

  const head = splitIPv6Groups(halves[0] ?? "");
  const tail = halves.length === 2 ? splitIPv6Groups(halves[1] ?? "") : [];
  if (!head || !tail) {
    return null;
  }

  const missing = 8 - head.length - tail.length;
  if (halves.length === 1) {
    if (missing !== 0) {
      return null;
    }
    return head;
  }

  if (missing < 1) {
    return null;
  }

  return [...head, ...Array.from({ length: missing }, () => 0), ...tail];
}

function splitIPv6Groups(value: string): number[] | null {
  if (value === "") {
    return [];
  }

  const groups: number[] = [];
  for (const raw of value.split(":")) {
    if (!/^[0-9a-f]{1,4}$/.test(raw)) {
      return null;
    }
    groups.push(Number.parseInt(raw, 16));
  }
  return groups;
}
