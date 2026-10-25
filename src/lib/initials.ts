/**
 * Up to two leading initials of a display name, uppercased ("Ana Maria Silva" -> "AM").
 * Returns `fallback` when the name has no visible characters.
 */
export function nameInitials(name: string, fallback: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || fallback
  );
}
