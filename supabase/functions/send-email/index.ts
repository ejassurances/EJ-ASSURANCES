import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }

// Vérifie l'authentification de l'appelant DANS le code (indépendamment du toggle
// verify_jwt du Dashboard, qui accepte la clé anon publique et n'est donc pas une
// vraie protection). Autorise :
//   - le service role (appels serveur de confiance : routes API, autres fonctions) ;
//   - un JWT utilisateur valide de rôle interne (admin / courtier).
// Rejette : header absent, token invalide, ou clé anon → 401 ; utilisateur non
// autorisé → 403.
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

async function getGmailToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID"), client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"), refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token" }),
  })
  const { access_token, error } = await res.json()
  if (error) throw new Error("OAuth: " + error)
  return access_token
}

function buildEmail(to, subject, html, fromName, fromEmail) {
  const raw = ["From: " + fromName + " <" + fromEmail + ">","To: " + to,"Subject: " + subject,"MIME-Version: 1.0","Content-Type: text/html; charset=UTF-8","",html].join("\r\n")
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,"-").replace(/\//g,"_")
}

async function sendGmail(to, subject, html, token) {
  const email = Deno.env.get("ADVISOR_EMAIL") || "contact@ej-assurances.fr"
  const name = Deno.env.get("ADVISOR_NAME") || "Erwan Jaffrelot"
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildEmail(to, subject, html, name, email) }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error("Gmail: " + JSON.stringify(data))
  return data.id
}

const T = {
  contact_ae_confirmation: (d) => ({ subject: "Demande AE recue - EJ Assurances", html: "<p>Bonjour " + d.prenom + ", votre demande est bien recue. Rappel sous 48h.</p>" }),
  workflow_step_2: (d) => ({ subject: "Fiche conseil - EJ Assurances", html: "<p>Bonjour " + d.prenom + ", <a href='" + (d.esignature_link||'#') + "'>Signer</a></p>" }),
  workflow_step_3: (d) => ({ subject: "Recueil a signer - EJ Assurances", html: "<p>Bonjour " + d.prenom + ", <a href='" + (d.esignature_link||'#') + "'>Signer recueil</a></p>" }),
  workflow_step_4: (d) => ({ subject: "Souscription - EJ Assurances", html: "<p>Bonjour " + d.prenom + ", <a href='" + (d.souscription_link||'#') + "'>Souscrire</a></p>" }),
  invite_espace_client: (d) => ({ subject: "Espace client - EJ Assurances", html: "<p>Bonjour " + d.prenom + ", <a href='" + d.invite_link + "'>Acceder</a></p>" }),
  // Alerte interne (courtier) : nom client, nature de l'action, ancien/nouveau document
  // si applicable, lien direct vers le dossier Drive du client.
  staff_alert: (d) => ({
    subject: "[EJ Assurances] " + (d.nature || "Action a verifier") + " - " + (d.full_name || "client"),
    html:
      "<p><strong>Client :</strong> " + (d.full_name || "-") + "</p>"
      + "<p><strong>Action :</strong> " + (d.nature || "-") + "</p>"
      + ((d.ancien_document || d.nouveau_document)
          ? "<p><strong>Document :</strong> "
            + (d.ancien_document ? ("ancien &laquo; " + d.ancien_document + " &raquo; &rarr; ") : "")
            + "nouveau &laquo; " + (d.nouveau_document || "-") + " &raquo;</p>"
          : "")
      + "<p><a href=\"" + (d.google_drive_folder_url || "#") + "\">Ouvrir le dossier Drive du client</a></p>",
  }),
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  const auth = await requireAuth(req)
  if (auth === "forbidden") return denied(403)
  if (auth !== "ok") return denied(401)
  try {
    const { type, to, client_id, data: tData } = await req.json()
    let email = to, rData = tData || {}
    if (client_id) {
      const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))
      const { data: c } = await sb.from("clients").select("*").eq("id", client_id).single()
      if (c) { email = email || c.email; rData = { ...c, ...rData } }
    }
    if (!email) throw new Error("No email")
    if (!T[type]) throw new Error("Unknown type: " + type)
    const tmpl = T[type](rData)
    const token = await getGmailToken()
    const msgId = await sendGmail(email, tmpl.subject, tmpl.html, token)
    if (client_id) {
      const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))
      await sb.from("email_logs").insert({ client_id, type, subject: tmpl.subject, to: email, gmail_message_id: msgId, sent_at: new Date().toISOString() })
    }
    return new Response(JSON.stringify({ success: true, message_id: msgId }), { headers: { ...CORS, "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } })
  }
})
