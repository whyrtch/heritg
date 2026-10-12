import { t } from "@/i18n";

export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  switch (code) {
    case "invalid":
      return t("authError.invalid");
    case "rate-limited":
      return t("authError.rateLimited");
    case "offline":
      return t("authError.offline");
    case "invalid-credentials":
      return t("authError.credentials");
    default:
      return t("authError.generic");
  }
}
