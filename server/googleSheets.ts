import { SignJWT, importPKCS8 } from "jose";

export const GOOGLE_SHEET_ID = "1vAYHTnFarZgwoiH1HlqsEnIBYjgQl7QvcbJ5pfU7iG8";
export const GOOGLE_SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`;

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error("ยังไม่ได้ตั้งค่าบัญชี Google Service Account");
  }

  const privateKey = await importPKCS8(privateKeyRaw.replace(/\\n/g, "\n"), "RS256");

  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets.readonly" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("ไม่สามารถยืนยันตัวตนกับ Google ได้ในขณะนี้");
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

export async function fetchSheetValues(range: string): Promise<string[][]> {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error("ไม่สามารถดึงข้อมูลจาก Google Sheets ได้ในขณะนี้");
  }

  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
}

export function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map(row => row.map(cell => escapeCsvCell(cell ?? "")).join(",")).join("\n");
}
