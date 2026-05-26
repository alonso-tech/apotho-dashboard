import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { getVisibleBusinesses } from "@/lib/access";

export const GET = withApiAuth(async (_req, user) => {
  const businesses = await getVisibleBusinesses(user.id, user.role);
  return NextResponse.json({ data: businesses });
});
