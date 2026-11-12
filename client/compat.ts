// Window launching relies on Paseo Desktop internals that are not part of the plugin API
// (see client/web.ts and client/launch.ts). The manifest no longer caps `requirements.paseo`,
// so a newer Paseo keeps loading the plugin; instead the UI shows a notice until that release
// has been re-verified. After comparing the internals against a new release, raise VERIFIED_MAX.
export const VERIFIED_MIN = [0, 13, 2] as const;
/** Highest verified major.minor; every patch release of it counts as verified. */
export const VERIFIED_MAX = [0, 14] as const;
export const VERIFIED_LABEL = `${VERIFIED_MIN.join(".")} to ${VERIFIED_MAX.join(".")}.x`;

/** Electron's default user agent contains `<app name>/<app version>`; Paseo Desktop does not override it. */
export function parsePaseoVersion(userAgent: string | null | undefined): string | null {
  const match = /(?:^|\s)Paseo\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=\s|$)/.exec(userAgent ?? "");
  return match ? match[1] : null;
}

function numbers(version: string): number[] {
  return version.split("-")[0].split(".").map((part) => Number(part));
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

export type Compatibility = "verified" | "newer" | "older";

export function classifyVersion(version: string): Compatibility {
  const parts = numbers(version);
  if (compare(parts, VERIFIED_MIN) < 0) return "older";
  // Compare only major.minor against the ceiling so 0.14.7 is still verified.
  return compare(parts.slice(0, VERIFIED_MAX.length), VERIFIED_MAX) > 0 ? "newer" : "verified";
}

/** A muted notice for the launch surfaces, or null when nothing needs saying. */
export function compatibilityNotice(version: string | null): string | null {
  if (!version) return null;
  switch (classifyVersion(version)) {
    case "verified": return null;
    case "newer": return `Paseo Desktop ${version} has not been verified with Window Manager yet (verified: ${VERIFIED_LABEL}). Launching should still work. If windows open with the wrong projects, check for a plugin update.`;
    case "older": return `Window Manager was verified with Paseo Desktop ${VERIFIED_LABEL}. This is ${version}; launching may not work.`;
  }
}
