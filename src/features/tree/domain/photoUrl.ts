export type PhotoUrlValidation = { ok: true } | { ok: false; error: string };

export function validatePhotoUrl(value: string): PhotoUrlValidation {
  const candidate = value.trim();
  if (!candidate) return { ok: true };

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return { ok: false, error: "Photo URL must use HTTPS." };
    if (!url.hostname || url.username || url.password) return { ok: false, error: "Photo URL is not valid." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Photo URL is not valid." };
  }
}

export function isLegacyDataUrlPhoto(value: string | undefined): boolean {
  return typeof value === "string" && /^data:image\//i.test(value.trim());
}
