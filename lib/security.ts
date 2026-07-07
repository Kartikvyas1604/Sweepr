import { timingSafeEqual } from "./utils";

export function verifySecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqual(provided, expected);
}

export function verifyPassphrase(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected) return true;
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}
