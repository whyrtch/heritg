export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  switch (code) {
    case "invalid":
      return "Enter your email and password.";
    case "rate-limited":
      return "Too many attempts. Wait a moment and try again.";
    case "offline":
      return "Unable to connect. Check your internet connection and try again.";
    case "invalid-credentials":
      return "The email or password is incorrect.";
    default:
      return "Something went wrong. Please try again.";
  }
}
