-- F-06 (audit du 05/09/2026) : « Supprimer mon compte » faisait
-- `delete from profiles` — la clé étrangère va de profiles VERS auth.users,
-- l'utilisateur restait, pouvait se reconnecter sur un compte sans profil.
-- La suppression réelle passe désormais par la fonction Edge `compte-supprimer`
-- (auth.admin.deleteUser → CASCADE). On ferme le chemin direct, trompeur.
-- Retour arrière : recréer la policy ci-dessous.
begin;
drop policy if exists "profil supprimable par son proprietaire" on public.profiles;
commit;
