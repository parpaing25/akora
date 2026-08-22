-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 29. Aucun produit ne pouvait etre cree
-- ═══════════════════════════════════════════════════════════════════════════
-- `historiser_prix()` etait pose en BEFORE INSERT et ecrivait aussitot dans
-- `prix_historique` une ligne pointant vers `new.id`. A cet instant, le
-- produit n'existe pas encore : la cle etrangere echouait, et l'insertion
-- entiere etait annulee.
--
--   ERROR: insert or update on table "prix_historique" violates foreign key
--          constraint "prix_historique_produit_id_fkey"
--
-- Consequence : la creation d'un produit echouait a tous les coups. Le defaut
-- etait reste invisible parce qu'aucun fournisseur n'avait encore de
-- catalogue — il aurait bloque le tout premier depot, le jour du lancement.
--
-- Le remede est de separer les deux gestes, qui n'ont pas le meme moment :
--   · poser `prix_maj_le` MODIFIE la ligne : ce doit etre un BEFORE ;
--   · historiser REFERENCE la ligne : ce doit etre un AFTER.

-- ── Avant : on date la mise a jour du prix ────────────────────────────────
create or replace function public.dater_maj_prix()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.prix_unitaire is distinct from old.prix_unitaire then
    new.prix_maj_le := now();
  end if;
  return new;
end;
$$;

-- ── Apres : la ligne existe, on peut la referencer ───────────────────────
create or replace function public.historiser_prix()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.prix_unitaire is distinct from old.prix_unitaire then
    insert into public.prix_historique (produit_id, prix_unitaire)
    values (new.id, new.prix_unitaire);
  end if;
  return null; -- AFTER : la valeur de retour est ignoree.
end;
$$;

drop trigger if exists trg_produits_historiser_prix on public.produits;

drop trigger if exists trg_produits_dater_prix on public.produits;
create trigger trg_produits_dater_prix
  before insert or update of prix_unitaire on public.produits
  for each row execute function public.dater_maj_prix();

create trigger trg_produits_historiser_prix
  after insert or update of prix_unitaire on public.produits
  for each row execute function public.historiser_prix();

revoke all on function public.dater_maj_prix() from public, anon, authenticated;
revoke all on function public.historiser_prix() from public, anon, authenticated;
