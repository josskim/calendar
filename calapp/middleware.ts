import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)"],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "localhost:3000";
  const isLocalhost = hostname.startsWith("localhost:") || hostname === "localhost";
  const isAdminRoute = url.pathname.startsWith("/admin");

  if (isAdminRoute) {
    return NextResponse.next();
  }

  const searchParams = url.searchParams.toString();
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;

  if (isLocalhost || hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
    return NextResponse.next();
  }

  let slug = "";
  if (hostname.endsWith(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`)) {
    slug = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, "");
  } else {
    slug = hostname;
  }

  return NextResponse.rewrite(new URL(`/pensions/${slug}${path}`, req.url));
}
