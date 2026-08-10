// Endpoint central de la passerelle de tarification.
//   POST /api/tarification
//   Body : { riskType, prospect, clientId?, connectors? }
//   Réservé au personnel du cabinet (admin / courtier).
//
// Interroge en parallèle les API partenaires activées, renvoie une réponse
// unifiée (partenaire, produit, primes, documents) et pousse les devis dans le
// Drive du prospect.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runTarification } from "@/lib/api-insurance/gateway";
import type { ProspectData, RiskType, TarificationRequest } from "@/lib/api-insurance/types";

const RISK_TYPES: RiskType[] = ["sante", "prevoyance", "emprunteur", "auto", "multirisque_pro"];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const riskType = String(body.riskType ?? "") as RiskType;
    if (!RISK_TYPES.includes(riskType)) {
      return NextResponse.json(
        { error: `riskType invalide. Attendu : ${RISK_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const prospect = body.prospect as ProspectData | undefined;
    if (!prospect || !prospect.prenom || !prospect.nom) {
      return NextResponse.json({ error: "prospect.prenom et prospect.nom requis" }, { status: 400 });
    }

    const request: TarificationRequest = {
      riskType,
      prospect,
      clientId: body.clientId ? String(body.clientId) : undefined,
      connectors: Array.isArray(body.connectors) ? body.connectors.map(String) : undefined,
    };

    const result = await runTarification(request);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
