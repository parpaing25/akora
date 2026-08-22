import { z } from "zod";
import { MOTIF_TELEPHONE, compacterTelephone, normaliserTelephone } from "./format";

/**
 * Schémas Zod partagés. Zod couvre 100 % des formulaires (règle A3), mais il
 * n'est JAMAIS l'autorité : chaque règle a son pendant en base (contrainte
 * CHECK ou trigger). Le client ne décide de rien, surtout pas d'un montant.
 */

export const telephoneMalgache = z
  .string()
  .trim()
  .min(1, "Le numéro de téléphone est obligatoire.")
  .refine((v) => MOTIF_TELEPHONE.test(compacterTelephone(v)), {
    message: "Numéro invalide. Exemple attendu : 034 12 345 67.",
  })
  .transform((v) => normaliserTelephone(v) as string);

export const courriel = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est obligatoire.")
  .email("Adresse e-mail invalide.");

export const motDePasse = z
  .string()
  .min(8, "8 caractères minimum.")
  .max(72, "72 caractères maximum.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), {
    message: "Le mot de passe doit contenir au moins une lettre et un chiffre.",
  });

export const schemaConnexion = z.object({
  email: courriel,
  motDePasse: z.string().min(1, "Le mot de passe est obligatoire."),
});
export type ValeursConnexion = z.infer<typeof schemaConnexion>;

export const schemaInscription = z
  .object({
    nomComplet: z.string().trim().min(2, "Indiquez votre nom.").max(120, "120 caractères maximum."),
    email: courriel,
    telephone: telephoneMalgache,
    motDePasse,
    confirmation: z.string(),
    profil: z.enum(["acheteur", "fournisseur"]),
    raisonSociale: z.string().trim().max(160).optional(),
    // `boolean` plutot que `literal(true)` : le champ doit pouvoir repasser a
    // false quand on decoche, tout en refusant l'envoi tant qu'il l'est.
    conditions: z.boolean().refine((v) => v === true, {
      message: "Vous devez accepter les conditions d'utilisation.",
    }),
  })
  .refine((v) => v.motDePasse === v.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne sont pas identiques.",
  })
  .refine((v) => v.profil !== "fournisseur" || (v.raisonSociale ?? "").trim().length >= 2, {
    path: ["raisonSociale"],
    message: "Indiquez la raison sociale de votre entreprise.",
  });
export type ValeursInscription = z.infer<typeof schemaInscription>;

export const schemaMotDePasseOublie = z.object({ email: courriel });
export type ValeursMotDePasseOublie = z.infer<typeof schemaMotDePasseOublie>;
