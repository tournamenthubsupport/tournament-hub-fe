const DEFAULT_API_BASE_URL = "http://localhost:5000/api";

const rawBaseUrl = String(process.env.EXPO_PUBLIC_BASE_URL || "").trim();

function normalizeBaseUrl(value: string) {
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  const trimmed = value.replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    return trimmed;
  } catch {
    console.warn(
      `Invalid EXPO_PUBLIC_BASE_URL: ${value}. Falling back to ${DEFAULT_API_BASE_URL}`,
    );
    return DEFAULT_API_BASE_URL;
  }
}

export const API_BASE_URL = normalizeBaseUrl(rawBaseUrl);
