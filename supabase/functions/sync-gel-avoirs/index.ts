// sync-gel-avoirs — synchronise le registre national « gel des avoirs » (DGTrésor)
// dans public.gel_avoirs_registre (upsert par IdRegistre).
//
// Déclenchement : pg_cron quotidien (voir migration) ou appel manuel. Réservé au
// service role (auth in-code, indépendante du toggle verify_jwt).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
const FLUX_URL = "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-flux-json"
// User-Agent OBLIGATOIRE : l'API DGTrésor rejette les requêtes sans en-tête UA.
const USER_AGENT = "EJ-Assurances-CRM/1.0 (compliance LCB-FT)"

// Auth : service role (appels cron/serveur) ou JWT utilisateur interne (admin/courtier).
async function requireAuth(req: Request): Promise<"ok" | "forbidden" | "unauthenticated"> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim()
  if (!token) return "unauthenticated"
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (serviceKey && token === serviceKey) return "ok"
  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anonKey) return "unauthenticated"
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: "Bearer " + token } } })
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return "unauthenticated"
  const admin = createClient(url, serviceKey)
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "courtier"].includes(profile.role)) return "forbidden"
  return "ok"
}

// Normalisation pour le rapprochement flou : minuscule, sans accents/diacritiques.
function normalize(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

// Extrait les valeurs d'un TypeChamp donné dans le RegistreDetail.
function valeurs(detail: any[], typeChamp: string): any[] {
  const bloc = (detail || []).find((d) => d?.TypeChamp === typeChamp)
  return bloc?.Valeur ?? []
}

function flatten(entry: any, datePublication: string | null) {
  const detail: any[] = entry.RegistreDetail ?? []
  const prenoms = valeurs(detail, "PRENOM").map((v) => v?.Prenom).filter(Boolean)
  const alias = valeurs(detail, "ALIAS").map((v) => v?.Alias).filter(Boolean)
  const sexe = valeurs(detail, "SEXE")[0]?.Sexe ?? null
  const datesN = valeurs(detail, "DATE_DE_NAISSANCE")
  const anneesN = datesN.map((v) => parseInt(v?.Annee)).filter((n) => Number.isFinite(n))
  const lieuxN = valeurs(detail, "LIEU_DE_NAISSANCE").map((v) => v?.Lieu ?? v?.LieuDeNaissance).filter(Boolean)
  const nationalites = valeurs(detail, "NATIONALITE").map((v) => v?.Pays ?? v?.Nationalite).filter(Boolean)
  const fondements = valeurs(detail, "FONDEMENT_JURIDIQUE")
  const refsOnu = valeurs(detail, "REFERENCE_ONU").map((v) => v?.Reference ?? v?.ReferenceOnu).filter(Boolean)
  const refsUe = valeurs(detail, "REFERENCE_UE").map((v) => v?.Reference ?? v?.ReferenceUe).filter(Boolean)
  const motifs = valeurs(detail, "MOTIFS").map((v) => v?.Motifs).filter(Boolean).join(" ")

  const searchParts = [entry.Nom, ...prenoms, ...alias].filter(Boolean).join(" ")

  return {
    id_registre: entry.IdRegistre,
    nature: entry.Nature ?? null,
    nom: entry.Nom ?? null,
    prenoms: prenoms.length ? prenoms : null,
    alias: alias.length ? alias : null,
    sexe,
    dates_naissance: datesN.length ? datesN : null,
    annees_naissance: anneesN.length ? anneesN : null,
    lieux_naissance: lieuxN.length ? lieuxN : null,
    nationalites: nationalites.length ? nationalites : null,
    fondements_juridiques: fondements.length ? fondements : null,
    references_onu: refsOnu.length ? refsOnu : null,
    references_ue: refsUe.length ? refsUe : null,
    motifs: motifs || null,
    registre_detail: detail,
    search_text: normalize(searchParts),
    date_publication: datePublication,
    synced_at: new Date().toISOString(),
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  const auth = await requireAuth(req)
  if (auth === "forbidden") return new Response(JSON.stringify({ error: "Acces refuse" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } })
  if (auth !== "ok") return new Response(JSON.stringify({ error: "Non autorise" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } })

  try {
    const res = await fetch(FLUX_URL, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } })
    if (!res.ok) throw new Error("DGTresor HTTP " + res.status)
    const data = await res.json()
    const datePublication: string | null = data?.Publications?.DatePublication ?? null
    const entries: any[] = data?.Publications?.PublicationDetail ?? []
    if (!entries.length) throw new Error("Flux vide")

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const rows = entries.map((e) => flatten(e, datePublication))
    let upserted = 0
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const { error } = await supabase.from("gel_avoirs_registre").upsert(chunk, { onConflict: "id_registre" })
      if (error) throw new Error("Upsert: " + error.message)
      upserted += chunk.length
    }

    return new Response(
      JSON.stringify({ success: true, date_publication: datePublication, entries: entries.length, upserted }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } })
  }
})
