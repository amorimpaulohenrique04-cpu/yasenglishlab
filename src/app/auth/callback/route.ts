import { NextResponse, type NextRequest } from "next/server";

import { authContinuePath } from "@/modules/auth";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = authContinuePath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
