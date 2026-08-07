import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Protection par défaut de toutes les routes /api/*.
//
// Le middleware exige une session Supabase valide (authentification) pour toute
// requête vers /api/*, SAUF pour les exceptions ci-dessous. Il applique le même
// mécanisme d'authentification que lib/auth.ts (getCurrentUser → supabase.auth
// .getUser()) : getCurrentUser() lui-même ne peut pas être réutilisé tel quel
// car il dépend de `next/headers` (cookies()), indisponible dans le middleware
// (runtime edge). On reconstruit donc un client Supabase compatible middleware
// en lisant les cookies de la requête, et on valide la session de façon identique.
//
// Ce middleware ne fait que de l'AUTHENTIFICATION (session valide). Les contrôles
// de RÔLE éventuels restent gérés dans chaque route (requireRole / vérifs internes).
// ─────────────────────────────────────────────────────────────────────────────

// Routes publiques légitimes, exclues de la protection.
const PUBLIC_API_ROUTES = [
  "/api/cron/", // déclenché par Vercel Cron, déjà protégé par CRON_SECRET (Bearer)
  "/api/google/callback", // callback OAuth Google : aucune session à ce stade
  "/api/contact-ae", // formulaire de contact public (assurance emprunteur)
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) =>
    route.endsWith("/") ? pathname.startsWith(route) : pathname === route,
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Le matcher limite déjà à /api/*, mais on reste défensif.
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Route publique explicitement autorisée → on laisse passer.
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Les preflights CORS ne portent pas de cookies ; on les laisse passer
  // (aucune donnée n'est exposée, la vraie requête sera contrôlée).
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sans configuration Supabase, on ne peut pas authentifier : fail-closed.
  if (!url || !key) {
    return NextResponse.json({ error: "Authentification indisponible." }, { status: 401 });
  }

  // Réponse mutable : Supabase peut y rafraîchir les cookies de session.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  return supabaseResponse;
}

export const config = {
  // N'exécute le middleware que sur les routes API.
  matcher: ["/api/:path*"],
};
