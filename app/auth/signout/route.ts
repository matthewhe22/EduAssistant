import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  await createSupabaseServerClient()?.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
