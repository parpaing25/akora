import { supabase } from "@/integrations/supabase/client";

/**
 * Le pilotage de la plateforme — la console superadmin transposée de Fonenako.
 *
 * ⚠ TOUT PASSE PAR DES FONCTIONS GARDÉES EN BASE (`exiger_admin()`,
 *   `is_super_admin()`). `profiles` n'est lisible que par son propriétaire,
 *   les courriels vivent dans `auth.users`, et un tableau de bord qui ferait
 *   dix requêtes depuis le navigateur coûterait dix allers-retours sur une 3G.
 *   Un seul appel rend tous les chiffres ; cacher un bouton n'a jamais
 *   protégé une donnée (règle A3).
 */

export interface ChiffresDuJour {
  utilisateurs: number;
  utilisateurs_7j: number;
  actifs_7j: number;
  fournisseurs: Record<string, number> | null;
  fournisseurs_verifies: number;
  produits_actifs: number;
  produits_total: number;
  commandes: Record<string, number>;
  commandes_7j: number;
  volume_7j: number;
  commissions_7j: number;
  paiements_a_verifier: number;
  litiges_ouverts: number;
  retraits_a_traiter: number;
  kyc_en_attente: number;
  materiaux_demandes: number;
  publications: number;
  publications_signalees: number;
  demandes_ouvertes: number;
  releves_prix: number;
  vues_7j: number;
  avis_en_attente: number;
  calcule_le: string;
}

export async function chiffresDuJour(): Promise<ChiffresDuJour> {
  const { data, error } = await supabase.rpc("tableau_de_bord_admin");
  if (error) throw error;
  return data as unknown as ChiffresDuJour;
}

export interface PointSerie {
  jour: string;
  inscriptions: number;
  commandes: number;
  vues: number;
  volume: number;
}

export async function seriesAdmin(jours = 30): Promise<PointSerie[]> {
  const { data, error } = await supabase.rpc("series_admin", { _jours: jours });
  if (error) throw error;
  return (data ?? []) as PointSerie[];
}

export interface CompteAdmin {
  id: string;
  email: string | null;
  nom_complet: string | null;
  telephone: string | null;
  ville: string | null;
  type_client: string | null;
  roles: string[];
  fournisseur: string | null;
  fournisseur_statut: string | null;
  cree_le: string;
  derniere_connexion: string | null;
  email_verifie: boolean | null;
}

export async function listerUtilisateursAdmin(q = "", limite = 200): Promise<CompteAdmin[]> {
  const { data, error } = await supabase.rpc("lister_utilisateurs_admin", {
    _q: q.trim() || undefined,
    _limite: limite,
  });
  if (error) throw error;
  return (data ?? []) as CompteAdmin[];
}

export type RoleGouverne = "admin" | "super_admin";

/**
 * Donner ou retirer un rôle. Réservé au super_admin (la base le vérifie).
 * Renvoie les rôles après le geste.
 */
export async function definirRoleAdmin(
  userId: string,
  role: RoleGouverne,
  actif: boolean,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("definir_role_admin", {
    _user_id: userId,
    _role: role,
    _actif: actif,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}

export interface Activite {
  id: number;
  quand: string;
  acteur: string;
  action: string;
  entite: string;
  entite_id: string | null;
}

export async function activiteAdmin(limite = 30): Promise<Activite[]> {
  const { data, error } = await supabase.rpc("activite_admin", { _limite: limite });
  if (error) throw error;
  return (data ?? []) as Activite[];
}
