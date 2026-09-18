import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
  cookieStore.delete("auth_token");

  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set("token", "", { path: "/", maxAge: 0 });
  response.cookies.set("auth_token", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET() {
  return POST();
}
