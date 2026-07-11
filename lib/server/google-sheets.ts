import "server-only";

import crypto from "node:crypto";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getPrivateKey() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is missing.");
  }

  return key.replace(/\\n/g, "\n");
}

function getServiceAccountEmail() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL is missing.");
  }

  return email;
}

export function getGoogleSheetsSpreadsheetId() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is missing.");
  }

  return spreadsheetId;
}

export function ensureGoogleSheetsEnabled() {
  if (process.env.GOOGLE_SHEETS_ENABLED !== "true") {
    throw new Error("GOOGLE_SHEETS_ENABLED must be true.");
  }
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) {
    return tokenCache.token;
  }

  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claim = base64UrlJson({
    iss: getServiceAccountEmail(),
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  });
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(getPrivateKey(), "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const json = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google access token request failed.");
  }

  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600)
  };
  return tokenCache.token;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${SHEETS_API_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets API failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function encodeRange(range: string) {
  return encodeURIComponent(range).replace(/'/g, "%27");
}

export async function getSheetValues(spreadsheetId: string, range: string) {
  const result = (await sheetsFetch(`${spreadsheetId}/values/${encodeRange(range)}`)) as {
    values?: string[][];
  };
  return result.values ?? [];
}

export async function clearSheetRange(spreadsheetId: string, range: string) {
  await sheetsFetch(`${spreadsheetId}/values/${encodeRange(range)}:clear`, {
    method: "POST",
    body: "{}"
  });
}

export async function ensureSheetTabs(spreadsheetId: string, sheetNames: string[]) {
  const result = (await sheetsFetch(
    `${spreadsheetId}?fields=sheets.properties.title`
  )) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const existing = new Set(
    (result.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean)
  );
  const missing = Array.from(new Set(sheetNames)).filter((sheetName) => !existing.has(sheetName));

  if (missing.length === 0) return;

  await sheetsFetch(`${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: missing.map((title) => ({
        addSheet: { properties: { title } }
      }))
    })
  });
}

export async function updateSheetValues(spreadsheetId: string, range: string, values: unknown[][]) {
  return sheetsFetch(`${spreadsheetId}/values/${encodeRange(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({
      majorDimension: "ROWS",
      values
    })
  });
}
