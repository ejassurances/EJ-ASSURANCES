/**
 * ai-agent-gemini â Agent IA Gemini pour surveillance dossiers + emails auto
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const GEMINI_MODEL = "gemini-1.5-pro-latest"

// Vérifie l'authentification de l'appelant DANS le code (indépendamment du toggle
// verify_jwt du Dashboard, qui accepte la clé anon publique et n'est donc pas une
// vraie protection). Autorise le service role (appels serveur de confiance) ou un
// JWT utilisateur valide de rôle interne (admin / courtier). Rejette header absent,
// token invalide ou clé anon → 401 ; utilisateur non autorisé → 403.
async function requireAuth(req) {
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

function denied(status) {
  return new Response(JSON.stringify({ error: status === 403 ? "Acces refuse" : "Non autorise" }), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}

async function gemini(prompt, systemInstruction) {
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2048 } }
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY,  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ""
}

async function getOAuthToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID"), client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"), refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token" }) })
  const { access_token, error } = await res.json()
  if (error) throw new Error("OAuth: " + error)
  return access_token
}

async function monitorDossiers(supabase) {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data: staleProjects } = await supabase.from("projects").select("*, clients(prenom, nom, email)").not("status", "in", '("valide","resilie")').lt("updated_at", threeDaysAgo).limit(10)
  const results = []
  for (const project of (staleProjects || [])) {
    const client = project.clients
    if (!client) continue
    const analysis = await gemini("Dossier AE en attente depuis " + Math.floor((Date.now() - new Date(project.updated_at).getTime()) / 86400000) + " jours. Status: " + project.status + ". RELANCE tÃªlÃ©com? ACTION: [RELANcE|ATTETE]")
    if (analysis.includes("RELANCE")) {
      await supabase.functions.invoke("send-email", { body: { type: "workflow_step_2", client_id: project.client_id, data: { prenom: client.prenom } } })
      await supabase.from("tasks").insert({ client_id: project.client_id, project_id: project.id, title: "Relance auto Gemini", status: "en_cours", priority: "normale", assigned_to: "erwan", due_date: new Date(Date.now() + 86400000).toISOString(), notes: analysis })
      results.push("Relance: " + client.prenom + " " + client.nom)
    }
  }
  return results
}

async function analyzeEmail(supabase, gmailMessageId, clientId) {
  const token = await getOAuthToken()
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + gmailMessageId + "?format=full", { headers: { Authorization: "Bearer " + token } })
  const msg = await res.json()
  const parts = msg.payload?.parts || [msg.payload]
  let body = ""
  for (const part of parts) { if (part.mimeType === "text/plain" && part.body?.data) { body = atob(part.body.data.replace(/-/g,"+").replace(/_/g,"/")); break } }
  const headers = {}
  for (const h of (msg.payload?.headers || [])) headers[h.name.toLowerCase()] = h.value
  const summary = await gemini("Resume cet email en 2-3 phrases. De: " + headers.from + " Sujet: " + headers.subject + " Corps: " + body.slice(0, 2000), "Assistant courtier. Sois concis.")
  const gmailLink = "https://mail.google.com/mail/u/0/#all/" + gmailMessageId
  await supabase.from("email_logs").insert({ client_id: clientId, gmail_message_id: gmailMessageId, subject: headers.subject, from_email: headers.from, received_at: new Date(parseInt(msg.internalDate)).toISOString(), summary_gemini: summary, gmail_link: gmailLink, direction: "inbound" })
  return { summary, gmailLink }
}

async function reconcileCommissions(supabase, bulletinText) {
  const { data: clients } = await supabase.from("clients").select("id, prenom, nom").limit(200)
  const clientList = (clients || []).map(c => c.id + ": " + c.prenom + " " + c.nom).join("\n")
  const result = await gemini("Rapproche ce bulletin de commissions avec les clients.\nCLIENTS:\n" + clientList + "\nBULLETIN:\n" + bulletinText + "\nRetourne JSON: [{client_id,montant,type,periode,assureur,confidence}]", "JSON uniquement.")
  try {
    const commissions = JSON.parse(result.replace(/```json\n?|\n?```/g, ""))
    for (const c of (Array.isArray(commissions) ? commissions : [])) {
      if (c.confidence >= 70 && c.client_id) await supabase.from("commissions").insert({ client_id: c.client_id, montant: c.montant, type: c.type, periode: c.periode, assureur: c.assureur, gemini_confidence: c.confidence, status: "rapproche" })
    }
    return commissions
  } catch { return { raw: result, error: "Parsing failed" } }
}

async function ppeScreening(supabase, clientId) {
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single()
  if (!client) throw new Error("Client not found")
  const result = await gemini("LCB-FT: " + client.prenom + " " + client.nom + " est-il PPE ou gel des avoirs? JSON: {isPPE,isGelDesAvoirs,confidence,details,action}", "JSON uniquement.")
  let screening
  try { screening = JSON.parse(result.replace(/```json\n?|\n?```/g, "")) }
  catch { screening = { isPPE: false, isGelDesAvoirs: false, confidence: 0, details: result, action: "normal" } }
  await supabase.from("compliance_checks").insert({ client_id: clientId, type: "ppe_screening", result: screening, checked_by: "gemini-ai", checked_at: new Date().toISOString() })
  if (screening.action === "freeze") await supabase.from("tasks").insert({ client_id: clientId, title: "GEL DES AVOIRS POTENTIEL - Action requise", status: "en_cours", priority: "haute", assigned_to: "erwan", due_date: new Date(Date.now() + 3600000).toISOString(), notes: screening.details })
  return screening
}

// Normalisation pour le rapprochement flou (identique à sync-gel-avoirs).
function normalizeName(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

// Criblage « gel des avoirs » (LCB-FT) : rapprochement flou pg_trgm client ↔ registre,
// Gemini en SOUTIEN uniquement pour trancher les cas ambigus (homonymes).
// Exigence Trésor : une trace est TOUJOURS écrite dans compliance_checks, même sans correspondance.
async function gelAvoirsScreening(supabase, clientId) {
  const { data: client } = await supabase.from("clients").select("id, full_name, date_naissance").eq("id", clientId).single()
  if (!client) throw new Error("Client not found")
  const search = normalizeName(client.full_name || "")
  const clientYear = client.date_naissance ? new Date(client.date_naissance).getUTCFullYear() : null

  let candidates = []
  if (search) {
    const { data: matches } = await supabase.rpc("match_gel_avoirs", { p_search: search, p_threshold: 0.35 })
    candidates = matches || []
  }

  let decision = "no_match" // no_match | confirmed_match | potential_match | review
  let method = "trgm"
  let geminiVerdict = null

  if (candidates.length > 0) {
    const top = candidates[0]
    const dobMatch = clientYear && Array.isArray(top.annees_naissance) ? top.annees_naissance.includes(clientYear) : null
    const strong = top.score >= 0.8 && (dobMatch === true || (dobMatch === null && candidates.length === 1))
    if (strong) {
      decision = "confirmed_match"
    } else {
      // Cas ambigu → Gemini en soutien (jamais seule autorité).
      method = "trgm+gemini"
      try {
        const prompt = "Criblage gel des avoirs (LCB-FT). Client CRM: "
          + JSON.stringify({ nom: client.full_name, annee_naissance: clientYear })
          + "\nCandidats du registre national (rapprochement flou): "
          + JSON.stringify(candidates.map((c) => ({ id: c.id_registre, nom: c.nom, nature: c.nature, score: c.score, annees: c.annees_naissance, nationalites: c.nationalites })))
          + "\nMême personne ou homonyme ? Réponds STRICTEMENT en JSON: "
          + '{"decision":"match|no_match|review","id_registre":<id|null>,"confidence":0..1,"rationale":"..."}'
        const raw = await gemini(prompt, "Expert conformité LCB-FT. JSON strict uniquement. En cas de doute, 'review'.")
        geminiVerdict = JSON.parse(raw.replace(/```json\n?|\n?```/g, ""))
        decision = geminiVerdict?.decision === "match" ? "potential_match"
          : geminiVerdict?.decision === "no_match" ? "no_match" : "review"
      } catch (e) {
        geminiVerdict = { error: "gemini_failed", detail: String(e) }
        decision = "review" // échec Gemini → prudence, revue manuelle
      }
    }
  }

  const hit = decision !== "no_match"
  const result = {
    match: hit,
    decision,
    method,
    threshold: 0.35,
    client_name: client.full_name,
    client_birth_year: clientYear,
    candidates_count: candidates.length,
    candidates: candidates.slice(0, 10),
    gemini_verdict: geminiVerdict,
    screened_at: new Date().toISOString(),
  }

  // Trace OBLIGATOIRE (même sans correspondance) — exigence Trésor.
  await supabase.from("compliance_checks").insert({
    client_id: clientId,
    type: "gel_avoirs_screening",
    result,
    checked_by: method === "trgm" ? "auto-trgm" : "auto-trgm+gemini",
    checked_at: new Date().toISOString(),
  })

  if (decision === "confirmed_match" || decision === "potential_match") {
    await supabase.from("tasks").insert({
      client_id: clientId,
      title: "GEL DES AVOIRS — correspondance registre à vérifier",
      status: "en_cours", priority: "haute", assigned_to: "erwan",
      due_date: new Date(Date.now() + 3600000).toISOString(),
      notes: JSON.stringify(result).slice(0, 2000),
    })
  }
  return result
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  const auth = await requireAuth(req)
  if (auth === "forbidden") return denied(403)
  if (auth !== "ok") return denied(401)
  try {
    const body = await req.json()
    const { action, ...params } = body
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))
    let result
    switch (action) {
      case "monitor_dossiers": result = await monitorDossiers(supabase); break
      case "analyze_email": result = await analyzeEmail(supabase, params.gmail_message_id, params.client_id); break
      case "reconcile_commissions": result = await reconcileCommissions(supabase, params.bulletin_text); break
      case "ppe_screening": result = await ppeScreening(supabase, params.client_id); break
      case "gel_avoirs_screening": result = await gelAvoirsScreening(supabase, params.client_id); break
      case "client_query":
        const { data: client } = await supabase.from("clients").select("*").eq("id", params.client_id).single()
        result = await gemini("Client: " + JSON.stringify(client) + "\nQuestion: " + params.prompt, "Assistant EJ Assurances. Francais, concis.")
        break
      default: throw new Error("Unknown action: " + action)
    }
    return new Response(JSON.stringify({ success: true, result }), { headers: { ...CORS, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } })
  }
})
