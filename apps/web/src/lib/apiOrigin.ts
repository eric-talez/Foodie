export function parseApiOrigin(value: string | undefined): string | undefined {
  // Check the raw URL before parsing can normalize away paths or URL delimiters.
  if (!value || value.trim() !== value || !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(value)) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}
