import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any code between createServerClient and
  // supabase.auth.getUser() — refresh/session changes must propagate first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated users are redirected away from protected routes.
  if (!user && pathname !== "/authenticate") {
    const url = request.nextUrl.clone();
    url.pathname = "/authenticate";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Authenticated users don't need the login page.
  if (user && pathname === "/authenticate") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Everything except API routes, Next.js internals, and static images/files.
    "/((?!api|_next/static|_next/image|.*\\.(?:ico|jpeg|jpg|png|svg|gif|webp)$).*)",
  ],
};
