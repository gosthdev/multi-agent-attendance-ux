import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiPrefix(): string {
  const urlStr = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
  try {
    const url = new URL(urlStr);
    // Remove trailing slash if any
    return url.pathname.replace(/\/$/, "");
  } catch (e) {
    return "/api/v1";
  }
}
