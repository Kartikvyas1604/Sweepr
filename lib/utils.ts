import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { timingSafeEqual as cryptoTimingSafeEqual } from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSol(amount: number): string {
  return `${amount.toLocaleString("en-US")} SOL`;
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const buf = Buffer.alloc(Math.max(a.length, b.length));
    cryptoTimingSafeEqual(Buffer.from(a.padEnd(buf.length, "\0")), Buffer.from(b.padEnd(buf.length, "\0")));
    return false;
  }
  return cryptoTimingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[<>]/g, "")
    .replace(/[&"'/]/g, "")
    .trim()
    .slice(0, 40);
}

export function sanitizePoolName(name: string): string {
  return name
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 60);
}

export function validateAndSanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return "";
  }
}
