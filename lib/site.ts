export const SITE_NAME = "인투니";
export const CANONICAL_SITE_URL = "https://intooni.com";

export function isProductionDeployment() {
  const vercelEnv = process.env.VERCEL_ENV?.trim();

  if (vercelEnv) {
    return vercelEnv === "production";
  }

  return process.env.NODE_ENV === "production";
}

export function getSiteUrl() {
  if (process.env.NODE_ENV === "production") {
    return CANONICAL_SITE_URL;
  }

  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.startsWith("http") ? explicitUrl : `https://${explicitUrl}`;
  }

  return "http://localhost:3000";
}
