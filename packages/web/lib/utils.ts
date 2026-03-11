import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using `clsx` and `tailwind-merge`.
 * Handles conditional classes and resolves Tailwind CSS conflicts.
 *
 * @param inputs - Class values to merge (strings, arrays, objects, etc.).
 * @returns A single merged class string with conflicts resolved.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts initials from a full name string.
 * Takes the first character of each word and returns up to 2 characters, uppercased.
 *
 * @param name - The full name to extract initials from.
 * @returns Uppercase initials (1-2 characters), or "?" if the name is empty.
 *
 * @example
 * ```ts
 * getInitials("John Doe")    // "JD"
 * getInitials("Alice")       // "A"
 * getInitials("")            // "?"
 * ```
 */
export function getInitials(name: string): string {
  if (!name.trim()) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Deterministically converts a user ID string to an HSL color.
 * Used for generating consistent avatar/cursor colors per user.
 *
 * @param userID - The user ID to derive a color from.
 * @returns An HSL color string (e.g., `"hsl(120, 70%, 50%)"`).
 */
export function userIDToColor(userID: string): string {
  let hash = 0;
  for (let i = 0; i < userID.length; i++) {
    hash = ((hash << 5) - hash + userID.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
