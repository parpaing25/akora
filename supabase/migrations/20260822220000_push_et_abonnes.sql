-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 30. Les notifications partent vraiment, et suivre sert a quelque chose
-- ═══════════════════════════════════════════════════════════════════════════
-- Deux manques : les abonnements push etaient stockes sans que rien ne les
-- utilise, et « Suivre » un depot n'avait aucun effet — on suivait dans le
-- vide.
--
-- Choix d'architecture : le trigger n'appelle PAS l'Edge Function.
-- L'appeler exigerait `pg_net` et, surtout, le secret d'appel ecrit en clair
-- dans une fonction SQL — exactement ce qu'on s'interdit. C'est donc le cron
-- qui interroge `envoyer-push` chaque minute. Une minute de latence sur
-- l'annonce d'une baisse de parpaing n'a jamais fait perdre une vente ; un
-- secret en base, si.

alter table public.notifications
  add column if not exists poussee_le timestamptz;

comment on column public.notifications.poussee_le is
  'Horodatage de l''envoi push. Nul = en attente. C''est le seul marqueur de file : pas de table de queue a maintenir.';

create index if not exists idx_notifications_a_pousser
  on public.notifications(created_at) where poussee_le is null;

-- ── Prevenir ceux qui suivent ─────────────────────────────────────────────
-- Sans cela, l'abonnement n'est qu'un bouton qui change de couleur.
create or replace function public.prevenir_abonnes_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom  text;
  v_slug text;
  v_titre text;
begin
  if new.statut <> 'publiee' or new.fournisseur_id is null then
    return null;
  end if;

  select raison_sociale, slug into v_nom, v_slug
    from public.fournisseurs where id = new.fournisseur_id;

  v_titre := case new.type
    when 'baisse_prix' then v_nom || ' baisse ses prix'
    when 'livraison'   then v_nom || ' organise une tournee'
    else v_nom || ' annonce du stock'
  end;

  insert into public.notifications (user_id, titre, corps, lien, categorie)
  select a.user_id,
         v_titre,
         left(new.texte, 160),
         '/fournisseurs/' || v_slug,
         'fil'
    from public.abonnements a
    join public.fournisseurs f on f.id = a.fournisseur_id
   where a.fournisseur_id = new.fournisseur_id
     -- On ne se previent pas soi-meme de sa propre annonce.
     and a.user_id <> f.owner_id;

  return null;
end;
$$;

drop trigger if exists trg_publications_prevenir on public.publications;
create trigger trg_publications_prevenir
  after insert on public.publications
  for each row execute function public.prevenir_abonnes_publication();

revoke all on function public.prevenir_abonnes_publication() from public, anon, authenticated;
