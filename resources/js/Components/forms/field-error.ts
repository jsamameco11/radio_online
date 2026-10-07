/**
 * First validation message for any of these fields, including their nested
 * entries ("categories" also matches "categories.2") and domain errors the
 * backend reports under keys that are not form fields.
 */
export function fieldError(errors: object, ...keys: string[]): string | undefined {
  const entries = Object.entries(errors as Record<string, string | undefined>);
  for (const key of keys) {
    const match = entries.find(([name, message]) => message && (name === key || name.startsWith(`${key}.`)));
    if (match) return match[1];
  }
  return undefined;
}
