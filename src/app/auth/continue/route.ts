import { NextResponse, type NextRequest } from "next/server";

import { resolveAuthDestination } from "@/modules/auth";
import { resolveAuthContext } from "@/server/auth/context";

export async function GET(request: NextRequest) {
  const context = await resolveAuthContext();
  const destination = context
    ? resolveAuthDestination(context, request.nextUrl.searchParams.get("next"))
    : "/login";
  return new NextResponse(null, { status: 307, headers: { Location: destination } });
}
