import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/welcome", "/auth"];

// Absolute session lifetime: 8 hours from sign-in, regardless of activity.
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const START_COOKIE = "praxis_session_start";
const COOKIE_MAX_AGE = 60 * 60 * 8;

function expireResponse(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?expired=1";
  const res = NextResponse.redirect(url);
  // wipe auth + session-start cookies
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith("sb-") || c.name === START_COOKIE) {
      res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
    }
  });
  return res;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { maxAge: COOKIE_MAX_AGE },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (user) {
    const start = request.cookies.get(START_COOKIE)?.value;
    if (!start) {
      // first request after sign-in → stamp session start (session cookie: dies with the browser)
      response.cookies.set(START_COOKIE, String(Date.now()), {
        path: "/", httpOnly: true, sameSite: "lax",
      });
    } else if (Date.now() - Number(start) > MAX_SESSION_MS) {
      await supabase.auth.signOut();
      return expireResponse(request);
    }
  } else {
    // no user → make sure a stale start-stamp doesn't survive
    if (request.cookies.get(START_COOKIE)) {
      response.cookies.set(START_COOKIE, "", { maxAge: 0, path: "/" });
    }
  }

  if (!user && !isPublic && !pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
