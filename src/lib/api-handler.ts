import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "./api-auth";

export type ApiUser = { id: string; name: string; email: string; role: string };
type HandlerFn = (req: NextRequest, user: ApiUser) => Promise<NextResponse>;

export function withApiAuth(handler: HandlerFn) {
  return async (req: NextRequest) => {
    const user = await authenticateApiKey(req);
    if (!user) {
      return NextResponse.json(
        { error: "Missing or invalid API key. Use Authorization: Bearer ak_..." },
        { status: 401 }
      );
    }
    try {
      return await handler(req, user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = message.includes("not found") ? 404 : message.includes("Unauthorized") ? 403 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  };
}
