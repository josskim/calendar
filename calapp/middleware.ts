import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. /api routes
     * 2. /_next (next.js internals)
     * 3. /_static (static files)
     * 4. /favicon.ico, /sitemap.xml (special files)
     */
    "/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "localhost:3000";
  const isLocalhost = hostname.startsWith("localhost:") || hostname === "localhost";

  // 로컬 개발 환경 및 메인 도메인 제외 로직
  // 예: app.pension.com 이 메인 대시보드라면, 나머지는 테넌트로 간주
  const searchParams = url.searchParams.toString();
  const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`;

  // 1. 메인 도메인 (예: cal.com)이나 localhost인 경우 관리자 페이지로 이동 가능
  if (
    isLocalhost ||
    hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN
  ) {
    return NextResponse.next();
  }

  // 2. 서브도메인 또는 커스텀 도메인 처리
  // 이 부분에서 실제로는 DB 조회가 필요할 수 있으나, 
  // 성능을 위해 Vercel Edge Config나 도메인 패턴 매칭을 주로 사용합니다.
  // 여기서는 단순히 hostname을 slug로 간주하는 예시입니다.
  
  let slug = "";
  if (hostname.endsWith(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`)) {
    slug = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, "");
  } else {
    // 커스텀 도메인인 경우 (예: stay-namcheon.com)
    slug = hostname; 
  }

  // 내부적으로 /pensions/[slug]/... 경로로 rewriting
  return NextResponse.rewrite(
    new URL(`/pensions/${slug}${path}`, req.url)
  );
}
