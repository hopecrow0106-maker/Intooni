export function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    ("message" in error || "details" in error || "hint" in error || "code" in error)
  ) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      maybeError.code ? `code=${maybeError.code}` : "",
      maybeError.message ?? "",
      maybeError.details ? `details=${maybeError.details}` : "",
      maybeError.hint ? `hint=${maybeError.hint}` : ""
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
