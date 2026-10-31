const DEFAULT_MAX_LENGTH = 90;

/**
 * One-line PDP summary from the first non-empty line of the product description.
 * Cuts at a word boundary so long first lines never break the layout.
 */
export function getShortDescription(
  description: string | null | undefined,
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  const firstLine =
    String(description ?? "")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .find(Boolean) ?? "";

  if (firstLine.length <= maxLength) return firstLine;

  const cut = firstLine.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:–-]+$/, "")}…`;
}

/** True when the full description has more to say than the one-line summary. */
export function hasMoreThanShortDescription(
  description: string | null | undefined,
): boolean {
  const full = String(description ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!full) return false;
  return full !== getShortDescription(description, Number.MAX_SAFE_INTEGER);
}
