// Google Sheets API helper — refreshes access token, fetches sheet data

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials in environment variables");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to refresh Google token: ${err}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

export async function getSheetNames(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sheet names: ${await res.text()}`);
  }

  const data = await res.json();
  return data.sheets.map((s: { properties: { title: string } }) => s.properties.title);
}

export async function getSheetData(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const encodedSheet = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // Return empty if the sheet doesn't exist or can't be read
    return [];
  }

  const data = await res.json();
  return (data.values as string[][]) ?? [];
}

// Parse a dollar amount string to a number
function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export interface FinancialSummary {
  sheetName: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  rows: Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    isRevenue: boolean;
  }>;
  expenseByCategory: Record<string, number>;
}

/**
 * Fetch the MACU tab from a spreadsheet and parse transactions.
 * Looks for columns: Date, Description, Amount (or Debit/Credit).
 * Revenue = positive amounts, Expenses = negative amounts.
 */
export async function fetchFinancials(
  spreadsheetId: string,
  accessToken: string
): Promise<FinancialSummary[]> {
  const sheetNames = await getSheetNames(spreadsheetId, accessToken);

  // Find MACU tabs (case-insensitive match)
  const macuSheets = sheetNames.filter((name) =>
    name.toLowerCase().includes("macu") || name.toLowerCase().includes("bank")
  );

  // If no MACU tab found, try to use all sheets
  const sheetsToProcess = macuSheets.length > 0 ? macuSheets : sheetNames.slice(0, 3);

  const results: FinancialSummary[] = [];

  for (const sheetName of sheetsToProcess) {
    const rows = await getSheetData(spreadsheetId, sheetName, accessToken);
    if (rows.length < 2) continue;

    // Find header row (first row)
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const dateIdx = headers.findIndex((h) => h.includes("date"));
    const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("memo") || h.includes("payee"));
    const amountIdx = headers.findIndex((h) => h.includes("amount") || h.includes("debit") || h.includes("credit"));
    const categoryIdx = headers.findIndex((h) => h.includes("categ") || h.includes("type"));

    if (amountIdx === -1) continue; // Can't parse without amount column

    const parsedRows: FinancialSummary["rows"] = [];
    const expenseByCategory: Record<string, number> = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawAmount = row[amountIdx] ?? "";
      const amount = parseAmount(rawAmount);
      if (amount === 0) continue;

      const date = dateIdx >= 0 ? (row[dateIdx] ?? "") : "";
      const description = descIdx >= 0 ? (row[descIdx] ?? "") : row[1] ?? "";
      const category = categoryIdx >= 0 ? (row[categoryIdx] ?? "Uncategorized") : "Uncategorized";
      const isRevenue = amount > 0;

      if (!isRevenue) {
        const absAmount = Math.abs(amount);
        expenseByCategory[category] = (expenseByCategory[category] ?? 0) + absAmount;
      }

      parsedRows.push({ date, description, amount, category, isRevenue });
    }

    const revenue = parsedRows.filter((r) => r.isRevenue).reduce((s, r) => s + r.amount, 0);
    const expenses = parsedRows.filter((r) => !r.isRevenue).reduce((s, r) => s + Math.abs(r.amount), 0);

    results.push({
      sheetName,
      revenue,
      expenses,
      netIncome: revenue - expenses,
      rows: parsedRows,
      expenseByCategory,
    });
  }

  return results;
}
