import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/profile",
  "/home",
  "/studio",
  "/stream",
  "/watch",
];

const AUTH_ROUTES = ["/signin", "/signup"];

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return false;
    }

    const payload = decodeJwtPayload(token);

    if (!payload) {
      return false;
    }

    if (payload.exp) {
      return Date.now() < payload.exp * 1000;
    }

    return true;
  } catch {
    return false;
  }
}

export default function proxy(req: NextRequest) {
  console.log("MIDDLEWARE EXECUTED:", req.nextUrl.pathname);

  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;

  const isLoggedIn = token
    ? isTokenValid(token)
    : false;

  if (pathname === "/") {
    const url = req.nextUrl.clone();

    url.pathname = isLoggedIn
      ? "/home"
      : "/signin";

    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix + "/")
  );

  const isAuth = AUTH_ROUTES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix + "/")
  );

  if (isProtected && !isLoggedIn) {
    const url = req.nextUrl.clone();

    url.pathname = "/signin";

    return NextResponse.redirect(url);
  }

  if (isAuth && isLoggedIn) {
    const url = req.nextUrl.clone();

    url.pathname = "/home";

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/home/:path*",
    "/profile/:path*",
    "/studio/:path*",
    "/stream/:path*",
    "/watch/:path*",
    "/signin",
    "/signup",
  ],
};