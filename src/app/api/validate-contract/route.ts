import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { createSupabaseServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
    }
    if (!["admin", "courtier"].includes(user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 })
    }

    const supabase = createSupabaseServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 })
    }

    const body = await req.json()
    const { project_id, client_id, step, data } = body

    if (!project_id || !client_id) {
      return NextResponse.json({ error: "project_id and client_id required" }, { status: 400 })
    }

    // Map step to status and email type
    const stepMap: Record<string, { status: string; emailType: string }> = {
      "2": { status: "fiche_mission_envoyee", emailType: "workflow_step_2" },
      "3": { status: "recueil_signe", emailType: "workflow_step_3" },
      "4": { status: "souscription_envoyee", emailType: "workflow_step_4" },
      "validated": { status: "valide", emailType: "workflow_step_4" }
    }

    const stepConfig = stepMap[String(step)]
    if (!stepConfig) return NextResponse.json({ error: "Invalid step" }, { status: 400 })

    // Update project status
    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: stepConfig.status, ...data, updated_at: new Date().toISOString() })
      .eq("id", project_id)

    if (updateError) throw updateError

    // Get client for email
    const { data: client } = await supabase
      .from("clients")
      .select("prenom, nom, email")
      .eq("id", client_id)
      .single()

    // Send step email
    if (client) {
      await supabase.functions.invoke("send-email", {
        body: {
          type: stepConfig.emailType,
          client_id,
          data: { prenom: client.prenom, nom: client.nom, ...data }
        }
      })
    }

    // Create task for next step
    const nextStepTasks: Record<string, string> = {
      "2": "Attendre signature fiche recueil + envoyer DER et devis",
      "3": "VÃ©rifier documents signÃ©s + lancer souscription",
      "4": "Confirmer souscription assureur + archiver contrat"
    }

    if (nextStepTasks[String(step)]) {
      await supabase.from("tasks").insert({
        client_id,
        project_id,
        title: nextStepTasks[String(step)],
        status: "a_faire",
        priority: "normale",
        assigned_to: "erwan",
        due_date: new Date(Date.now() + 3 * 86400000).toISOString()
      })
    }

    return NextResponse.json({ success: true, new_status: stepConfig.status })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
