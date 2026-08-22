/**
 * Formats métier d'Akora : argent, téléphone, opérateur mobile money, dates.
 *
 * L'argent est en Ariary ENTIER, stocké en `bigint` côté base et manipulé en
 * `number` entier côté client. Aucun calcul monétaire en flottant : toute somme
 * qui transite ici est déjà arrondie à l'Ariary.
 */

/** Espace fine insécable (U+202F) — le séparateur de milliers imposé. */
export const ESPACE_FINE = "\u202F";

/** `1250000` → `"1 250 000"` (espaces fines insécables). */
export function formaterNombre(valeur: number): string {
  const entier = Math.trunc(Number.isFinite(valeur) ? valeur : 0);
  const signe = entier < 0 ? "-" : "";
  const chiffres = Math.abs(entier).toString();
  let sortie = "";
  for (let i = 0; i < chiffres.length; i++) {
    if (i > 0 && (chiffres.length - i) % 3 === 0) sortie += ESPACE_FINE;
    sortie += chiffres[i];
  }
  return signe + sortie;
}

/** `1250000` → `"1 250 000 Ar"`. */
export function formaterAriary(valeur: number): string {
  return `${formaterNombre(valeur)}${ESPACE_FINE}Ar`;
}

/**
 * Arrondi à la centaine d'Ariary SUPÉRIEURE.
 * Utilisé par le calcul de livraison (spec B6 étape 4) : on n'affiche jamais
 * un coût de transport avec des unités d'Ariary.
 */
export function arrondirCentaineSup(valeur: number): number {
  return Math.ceil(valeur / 100) * 100;
}

/* ── Téléphone ─────────────────────────────────────────────────────────── */

/** Un numéro mobile malgache valide, en saisie locale (`03X…`) ou internationale. */
export const MOTIF_TELEPHONE = /^(?:\+261|0)3[2-9]\d{7}$/;

/** Retire espaces (fines ou insécables comprises), points et tirets. */
export function compacterTelephone(saisie: string): string {
  return saisie.replace(/[\s.\u00A0\u202F-]/g, "");
}

export function telephoneValide(saisie: string): boolean {
  return MOTIF_TELEPHONE.test(compacterTelephone(saisie));
}

/**
 * Normalise vers la forme canonique `+2613XXXXXXXX` (sans espaces).
 * Renvoie `null` si le numéro n'est pas un mobile malgache valide.
 */
export function normaliserTelephone(saisie: string): string | null {
  const compact = compacterTelephone(saisie);
  if (!MOTIF_TELEPHONE.test(compact)) return null;
  return compact.startsWith("+261") ? compact : `+261${compact.slice(1)}`;
}

/** `+261341234567` → `"+261 34 12 345 67"`. Renvoie la saisie telle quelle si invalide. */
export function formaterTelephone(saisie: string): string {
  const canonique = normaliserTelephone(saisie);
  if (!canonique) return saisie;
  const n = canonique.slice(4); // 9 chiffres, commence par 3
  return `+261 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7, 9)}`;
}

import type { OperateurPaiement } from "./types-metier";

/* ── Opérateurs mobile money ───────────────────────────────────────────── */

// Le type vient des enumerations Postgres generees, pas d'une copie locale.
export type { OperateurPaiement } from "./types-metier";

export const NOM_OPERATEUR: Record<OperateurPaiement, string> = {
  mvola: "MVola",
  orange_money: "Orange Money",
  airtel_money: "Airtel Money",
};

/**
 * Devine l'opérateur d'après le préfixe. Sert UNIQUEMENT à présélectionner :
 * beaucoup de gens paient depuis un autre numéro que celui de contact, donc on
 * avertit sans jamais bloquer (spec A6).
 */
export function operateurProbable(saisie: string): OperateurPaiement | null {
  const canonique = normaliserTelephone(saisie);
  if (!canonique) return null;
  const prefixe = canonique.slice(4, 6); // « 32 », « 33 », « 34 », « 38 »…
  if (prefixe === "32") return "orange_money";
  if (prefixe === "33") return "airtel_money";
  if (prefixe === "34" || prefixe === "38") return "mvola";
  return null;
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

/** `JJ/MM/AAAA` au fuseau Indian/Antananarivo (UTC+3). */
export function formaterDate(valeur: string | Date | null | undefined): string {
  if (!valeur) return "—";
  const d = typeof valeur === "string" ? new Date(valeur) : valeur;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Indian/Antananarivo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** `JJ/MM/AAAA à HH:MM`. */
export function formaterDateHeure(valeur: string | Date | null | undefined): string {
  if (!valeur) return "—";
  const d = typeof valeur === "string" ? new Date(valeur) : valeur;
  if (Number.isNaN(d.getTime())) return "—";
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Indian/Antananarivo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const p = (t: string) => parties.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} à ${p("hour")}:${p("minute")}`;
}

/** `12,4 km` — une décimale, virgule française. */
export function formaterDistance(km: number): string {
  return `${km.toFixed(1).replace(".", ",")}${ESPACE_FINE}km`;
}

/** `4,3` sur 5. */
export function formaterNote(note: number | null | undefined): string {
  return note == null ? "—" : note.toFixed(1).replace(".", ",");
}

/** Slug ASCII, minuscules, tirets — pour les URL françaises sans accent (D6). */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
