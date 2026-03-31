import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleAccessToken, fetchFinancials } from "@/lib/google-sheets";

// Map business slugs to their Google Sheet IDs
const SHEET_MAP: Record<string, string> = {
  "evolution-drafting": process.env.EVOLUTION_SHEET_ID ?? "",
  "sentri-homes": process.env.SENTRI_SHEET_ID ?? "",
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  const sheetId = SHEET_MAP[slug];

  if (!sheetId) {
    return NextResponse.json(
      { error: `No Google Sheet configured for business: ${slug}`, data: [] },
      { status: 200 }
    );
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const financials = await fetchFinancials(sheetId, accessToken);
    return NextResponse.json({ data: financials });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[financials API]", message);
    return NextResponse.json({ error: message, data: [] }, { status: 500 });
  }
}
