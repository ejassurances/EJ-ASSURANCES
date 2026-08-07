import { NextRequest, NextResponse } from 'next/server';
import { traiterDocument, anonymiserTexte } from '@/lib/anonymisation/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Vérification auth
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérification du rôle : réservé à l'équipe interne (admin / courtier).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !['admin', 'courtier'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { contenuBase64, typeFichier, texteDirecte, mode = 'ia' } = body;

    let resultat;

    if (texteDirecte) {
      // Anonymisation d'un texte directement fourni (mode rapide)
      resultat = anonymiserTexte(texteDirecte);
    } else if (contenuBase64 && typeFichier) {
      // Anonymisation d'un document (extraction + anonymisation)
      resultat = await traiterDocument(contenuBase64, typeFichier, mode);
    } else {
      return NextResponse.json(
        { error: 'Fournir soit contenuBase64+typeFichier, soit texteDirecte' },
        { status: 400 }
      );
    }

    return NextResponse.json(resultat);
  } catch (error) {
    console.error('Erreur anonymisation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'anonymisation' },
      { status: 500 }
    );
  }
}
