import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const result = await supabase?.auth.exchangeCodeForSession(code);
    const user = result?.data.user;
    if (supabase && user) {
      const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "";
      const businessName = typeof user.user_metadata.business_name === "string" ? user.user_metadata.business_name : "";
      if (fullName || businessName) {
        await supabase.from("profiles").update({
          ...(fullName ? { full_name: fullName } : {}),
          ...(businessName ? { business_name: businessName } : {}),
        }).eq("id", user.id);
      }
    }
  }
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
