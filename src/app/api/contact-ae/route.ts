import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { isRateLimited } from "@/lib/rate-limit"

export const runtime = "nodejs"

const ENDPOINT = "contact-ae"
const MAX_BODY_BYTES = 64 * 1024
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function requestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || "0")
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 })
  }

  const ip = requestIp(req)
  if (isRateLimited(`${ENDPOINT}:ip:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const prenom = normalized(body.prenom)
  const nom = normalized(body.nom)
  const email = normalized(body.email).toLowerCase()
  if (!prenom || !nom || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Champs obligatoires invalides" }, { status: 400 })
  }

  if (isRateLimited(`${ENDPOINT}:email:${email}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard" }, { status: 429 })
  }

  const supabase = createSupabaseServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 500 })
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null
  if (idempotencyKey && !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return NextResponse.json({ error: "Clé de requête invalide" }, { status: 400 })
  }

  let claimed = false
  if (idempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from("public_intake_idempotency")
      .select("status, client_id, project_id")
      .eq("endpoint", ENDPOINT)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingError) {
      console.error("contact-ae idempotency lookup error:", existingError)
      return NextResponse.json({ error: "Service indisponible" }, { status: 500 })
    }

    if (existing?.status === "completed") {
      return NextResponse.json({
        success: true,
        client_id: existing.client_id,
        project_id: existing.project_id,
        replayed: true,
      })
    }

    if (existing?.status === "pending") {
      return NextResponse.json({ error: "Requête déjà en cours" }, { status: 409 })
    }

    const { error: claimError } = await supabase
      .from("public_intake_idempotency")
      .insert({ endpoint: ENDPOINT, idempotency_key: idempotencyKey })

    if (claimError) {
      if (claimError.code === "23505") {
        return NextResponse.json({ error: "Requête déjà en cours" }, { status: 409 })
      }
      console.error("contact-ae idempotency claim error:", claimError)
      return NextResponse.json({ error: "Service indisponible" }, { status: 500 })
    }
    claimed = true
  }

  try {
    const telephone = normalized(body.telephone)
    const date_naissance = normalized(body.date_naissance)
    const adresse = normalized(body.adresse)
    const situation = normalized(body.situation)
    const employeur = normalized(body.employeur)
    const revenus = body.revenus
    const montant_credit = body.montant_credit
    const duree_credit = body.duree_credit
    const assureur_actuel = normalized(body.assureur_actuel)
    const motif = normalized(body.motif)

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert(
        {
          prenom,
          nom,
          email,
          telephone,
          date_naissance,
          adresse,
          situation_professionnelle: situation,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single()

    if (clientError || !client) throw clientError || new Error("Client introuvable")

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: client.id,
        type: "assurance_emprunteur",
        status: "recueil_besoins",
        montant_credit,
        duree_credit,
        assureur_actuel,
        motif_demande: motif,
        employeur,
        revenus,
      })
      .select("id")
      .single()

    if (projectError || !project) throw projectError || new Error("Dossier introuvable")

    if (idempotencyKey) {
      const { error: completeError } = await supabase
        .from("public_intake_idempotency")
        .update({
          status: "completed",
          client_id: client.id,
          project_id: project.id,
          completed_at: new Date().toISOString(),
        })
        .eq("endpoint", ENDPOINT)
        .eq("idempotency_key", idempotencyKey)

      if (completeError) throw completeError
    }

    // External side effects happen only after the business records exist.
    const emailResult = await supabase.functions.invoke("send-email", {
      body: {
        type: "contact_ae_confirmation",
        client_id: client.id,
        data: { prenom, nom },
      },
    })
    if (emailResult.error) console.error("contact-ae send-email error:", emailResult.error)

    const driveResult = await supabase.functions.invoke("create-drive-folder", {
      body: { client_id: client.id, client_name: `${prenom} ${nom}` },
    })
    if (driveResult.error) console.error("contact-ae create-drive-folder error:", driveResult.error)

    return NextResponse.json({
      success: true,
      client_id: client.id,
      project_id: project.id,
    })
  } catch (error) {
    if (claimed && idempotencyKey) {
      await supabase
        .from("public_intake_idempotency")
        .delete()
        .eq("endpoint", ENDPOINT)
        .eq("idempotency_key", idempotencyKey)
    }

    console.error("contact-ae error:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Impossible de traiter la demande" }, { status: 500 })
  }
}
