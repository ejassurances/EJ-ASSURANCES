import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

const ENDPOINT = "contact-ae";
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

function isValidIdempotencyKey(value: string | null): value is string {
  return !!value && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    }

    const body = await req.json();
    const {
      prenom,
      nom,
      email,
      telephone,
      date_naissance,
      adresse,
      situation,
      employeur,
      revenus,
      montant_credit,
      duree_credit,
      assureur_actuel,
      motif,
    } = body ?? {};

    if (
      typeof prenom !== "string" ||
      typeof nom !== "string" ||
      prenom.trim().length === 0 ||
      nom.trim().length === 0 ||
      prenom.length > 100 ||
      nom.length > 100 ||
      !isValidEmail(email)
    ) {
      return NextResponse.json({ error: "Données de contact invalides." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const normalizedEmail = email.trim().toLowerCase();
    if (isRateLimited(`contact-ae:${ip}:${normalizedEmail}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 });
    }

    const idempotencyHeader = req.headers.get("Idempotency-Key");
    if (idempotencyHeader && !isValidIdempotencyKey(idempotencyHeader.trim())) {
      return NextResponse.json({ error: "Idempotency-Key invalide." }, { status: 400 });
    }
    const idempotencyKey = idempotencyHeader?.trim() || null;

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("public_intake_idempotency")
        .select("status, client_id, project_id")
        .eq("endpoint", ENDPOINT)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing?.status === "completed" && existing.client_id && existing.project_id) {
        return NextResponse.json({
          success: true,
          replay: true,
          client_id: existing.client_id,
          project_id: existing.project_id,
        });
      }

      if (existing?.status === "pending") {
        return NextResponse.json(
          { error: "Cette demande est déjà en cours de traitement." },
          { status: 409 },
        );
      }

      const { error: claimError } = await supabase
        .from("public_intake_idempotency")
        .insert({ endpoint: ENDPOINT, idempotency_key: idempotencyKey });

      if (claimError) {
        if (claimError.code === "23505") {
          return NextResponse.json(
            { error: "Cette demande est déjà en cours de traitement." },
            { status: 409 },
          );
        }
        throw claimError;
      }
    }

    try {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .upsert(
          {
            prenom,
            nom,
            email: normalizedEmail,
            telephone,
            date_naissance,
            adresse,
            situation_professionnelle: situation,
          },
          { onConflict: "email" },
        )
        .select()
        .single();

      if (clientError) throw clientError;

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
        .select()
        .single();

      if (projectError) throw projectError;

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
          .eq("idempotency_key", idempotencyKey);

        if (completeError) throw completeError;
      }

      // External side effects happen only after the business records exist.
      // Their own failures are logged but do not cause a second CRM submission
      // when the caller retries with the same Idempotency-Key.
      await supabase.functions.invoke("send-email", {
        body: { type: "contact_ae_confirmation", client_id: client.id, data: { prenom, nom } },
      });

      await supabase.functions.invoke("create-drive-folder", {
        body: { client_id: client.id, client_name: `${prenom} ${nom}` },
      });

      return NextResponse.json({
        success: true,
        client_id: client.id,
        project_id: project.id,
      });
    } catch (error) {
      if (idempotencyKey) {
        await supabase
          .from("public_intake_idempotency")
          .delete()
          .eq("endpoint", ENDPOINT)
          .eq("idempotency_key", idempotencyKey);
      }
      throw error;
    }
  } catch (error) {
    console.error("contact-ae error:", error);
    return NextResponse.json({ error: "Erreur lors du traitement de la demande." }, { status: 500 });
  }
}

export const runtime = "nodejs";
