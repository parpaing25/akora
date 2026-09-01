import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { useAntiAbus } from "@/hooks/useAntiAbus";
import { grouperParFournisseur, usePanier } from "@/lib/panier";
import { usePointLivraison } from "@/lib/point-livraison";
import { listerFournisseursParIds } from "@/lib/donnees/vitrine";
import { creerCommandes } from "@/lib/donnees/commandes";
import { useLivraison } from "@/hooks/useLivraison";
import { formaterAriary, normaliserTelephone, telephoneValide } from "@/lib/format";
import { LIBELLE_MODE_PAIEMENT, type ModePaiement } from "@/lib/types-metier";
import { Carte } from "@/components/ui/card";
import { Champ } from "@/components/ui/champ";
import { Saisie, ZoneTexte } from "@/components/ui/input";
import { Bouton } from "@/components/ui/button";
import { GroupeRadio, OptionRadio } from "@/components/ui/radio-group";
import { AvertissementMetier, EtatVide } from "@/components/ui/etats";
import { SelecteurPoint } from "@/components/livraison/SelecteurPoint";
import { BadgeVerification } from "@/components/marque/BadgeVerification";

/**
 * Tunnel de commande.
 *
 * Le panier se scinde ici en une commande par fournisseur (spec B8). Rien
 * n'est calculé dans cette page : elle envoie des identifiants et des
 * quantités à l'Edge Function, qui recalcule tout. Ce qui s'affiche ci-dessous
 * est un rappel, pas une autorité.
 */
export default function Commander() {
  const naviguer = useNavigate();
  const { session, profil } = useAuth();
  const antiAbus = useAntiAbus();
  const lignes = usePanier((e) => e.lignes);
  const vider = usePanier((e) => e.vider);
  const { point } = usePointLivraison();

  const [nom, setNom] = React.useState("");
  const [telephone, setTelephone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [adresse, setAdresse] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [mode, setMode] = React.useState<ModePaiement>("a_la_livraison");
  const [enCours, setEnCours] = React.useState(false);

  React.useEffect(() => {
    if (profil?.nom_complet) setNom((n) => n || profil.nom_complet!);
    if (profil?.telephone) setTelephone((t) => t || profil.telephone!);
    if (session?.user.email) setEmail((e) => e || session.user.email!);
  }, [profil, session]);

  const groupes = React.useMemo(() => grouperParFournisseur(lignes), [lignes]);

  // Les fournisseurs DU PANIER, par identifiants : une page d'annuaire ne les
  // contenait pas forcément, et la livraison devenait muettement inchiffrable.
  const fournisseurs = useQuery({
    queryKey: ["fournisseurs-commande", groupes.map((g) => g.fournisseurId).join(",")],
    queryFn: () => listerFournisseursParIds(groupes.map((g) => g.fournisseurId)),
    enabled: groupes.length > 0,
    staleTime: 5 * 60_000,
  });
  const parId = new Map((fournisseurs.data ?? []).map((f) => [f.id as string, f]));

  const livraisons = useLivraison(
    groupes.map((groupe) => {
      const f = parId.get(groupe.fournisseurId);
      return {
        fournisseurId: groupe.fournisseurId,
        rayonMaxKm: Number(f?.rayon_max_km ?? 40),
        coefSinuosite: f?.coef_sinuosite == null ? null : Number(f.coef_sinuosite),
        depart: f?.lat == null || f.lng == null ? null : { lat: Number(f.lat), lng: Number(f.lng) },
        lignes: groupe.lignes.map((l) => ({
          quantite: l.quantite,
          poids_kg_unite: l.poidsKgUnite,
          volume_m3_unite: l.volumeM3Unite,
        })),
        montantProduits: groupe.montantProduits,
      };
    }),
  );

  // Le paiement en ligne n'est proposé que si TOUS les fournisseurs du panier
  // l'acceptent, sont vérifiés, et que chaque livraison est chiffrable.
  const paiementEnLignePossible =
    Boolean(session) &&
    groupes.length > 0 &&
    groupes.every((groupe) => {
      const f = parId.get(groupe.fournisseurId);
      const l = livraisons.get(groupe.fournisseurId);
      const verifie = ["verifie", "partenaire"].includes(String(f?.niveau_verification));
      const estimable = l?.statut === "estimee" || l?.statut === "offerte";
      const modes = (f?.modes_paiement_acceptes ?? []) as string[];
      return verifie && estimable && modes.some((m) => m !== "a_la_livraison");
    });

  const totalGeneral = groupes.reduce((somme, groupe) => {
    const l = livraisons.get(groupe.fournisseurId);
    return somme + groupe.montantProduits + (l?.statut === "estimee" ? l.cout : 0);
  }, 0);

  const envoyer = async () => {
    const refus = antiAbus.verifier();
    if (refus) {
      toast.error(refus);
      return;
    }
    if (nom.trim().length < 2) {
      toast.error("Indiquez votre nom.");
      return;
    }
    if (!telephoneValide(telephone)) {
      toast.error("Numéro invalide", { description: "Format attendu : 034 12 345 67." });
      return;
    }
    setEnCours(true);
    try {
      const { commandes } = await creerCommandes({
        lignes: lignes.map((l) => ({ produit_id: l.produitId, quantite: l.quantite })),
        nom_contact: nom.trim(),
        telephone_contact: normaliserTelephone(telephone) as string,
        email_contact: email.trim() || null,
        localite_id: point?.localiteId ?? null,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        adresse_libre: adresse.trim() || null,
        mode_paiement: mode,
        message: message.trim() || null,
      });
      vider();
      const premiere = commandes[0];
      toast.success(
        commandes.length > 1 ? `${commandes.length} commandes envoyées` : "Commande envoyée",
        { description: commandes.map((c) => c.numero).join(", ") },
      );
      naviguer(premiere ? "/commande/" + premiere.numero : "/compte/commandes");
    } catch (erreur) {
      toast.error("Commande refusée", { description: (erreur as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  if (lignes.length === 0) {
    return (
      <div className="container py-10">
        <Seo titre="Commander" chemin="/commander" indexable={false} />
        <EtatVide
          titre="Rien à commander"
          phrase="Votre panier est vide."
          action={
            <Bouton asChild>
              <Link to="/materiaux">Voir les matériaux</Link>
            </Bouton>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6">
      <Seo titre="Commander" chemin="/commander" indexable={false} />
      <h1 className="text-page">Commander</h1>
      <p className="mt-1 text-legende text-muted-foreground">
        Votre panier donnera <span className="nombres">{groupes.length}</span> commande
        {groupes.length > 1 ? "s" : ""} séparée{groupes.length > 1 ? "s" : ""}, une par fournisseur.
      </p>

      <div className="mt-4 space-y-4">
        <Carte className="p-4">
          <h2 className="text-produit">1. Où livrer</h2>
          <div className="mt-3 space-y-3">
            <SelecteurPoint />
            <Champ etiquette="Précisions d'adresse" aide="Rue, quartier, point de repère, nom du chantier.">
              {(a) => <Saisie {...a} value={adresse} onChange={(e) => setAdresse(e.target.value)} />}
            </Champ>
          </div>
        </Carte>

        <Carte className="p-4">
          <h2 className="text-produit">2. Qui contacter</h2>
          <div className="mt-3 space-y-3">
            <input type="text" {...antiAbus.proprietesLeurre} />
            <Champ etiquette="Nom et prénom" obligatoire>
              {(a) => <Saisie {...a} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />}
            </Champ>
            <Champ etiquette="Téléphone" aide="Le fournisseur vous appellera pour la livraison." obligatoire>
              {(a) => (
                <Saisie
                  {...a}
                  type="tel"
                  inputMode="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  autoComplete="tel"
                />
              )}
            </Champ>
            <Champ etiquette="Adresse e-mail" aide="Facultatif. Pour recevoir le reçu.">
              {(a) => (
                <Saisie
                  {...a}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              )}
            </Champ>
            <Champ etiquette="Message au fournisseur">
              {(a) => <ZoneTexte {...a} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />}
            </Champ>
          </div>
        </Carte>

        <Carte className="p-4">
          <h2 className="text-produit">3. Paiement</h2>
          <div className="mt-3">
            {!session ? (
              <AvertissementMetier
                titre="Un compte est nécessaire pour payer en ligne"
                action={
                  <Bouton asChild variante="secondaire" taille="compact">
                    <Link to="/connexion" state={{ retour: "/commander" }}>
                      Se connecter
                    </Link>
                  </Bouton>
                }
              >
                Vous pouvez commander sans compte et régler à la livraison. Le paiement par mobile
                money, lui, met votre argent sous séquestre jusqu'à la réception — et ça suppose de
                pouvoir vous identifier.
              </AvertissementMetier>
            ) : !paiementEnLignePossible ? (
              <AvertissementMetier titre="Paiement en ligne indisponible pour ce panier">
                Il faut que chaque fournisseur soit vérifié, qu'il l'accepte, et que sa livraison
                soit chiffrable. Le règlement se fera à la livraison.
              </AvertissementMetier>
            ) : null}

            <GroupeRadio
              className="mt-3"
              value={mode}
              onValueChange={(v) => setMode(v as ModePaiement)}
            >
              <OptionRadio
                id="mode-livraison"
                valeur="a_la_livraison"
                titre={LIBELLE_MODE_PAIEMENT.a_la_livraison}
                detail="Vous réglez le livreur. Akora n'intervient pas dans la transaction."
              />
              <OptionRadio
                id="mode-acompte"
                valeur="en_ligne_acompte"
                titre={LIBELLE_MODE_PAIEMENT.en_ligne_acompte}
                detail="L'acompte est retenu par Akora jusqu'à la livraison, puis versé au fournisseur."
                desactive={!paiementEnLignePossible}
              />
              <OptionRadio
                id="mode-integral"
                valeur="en_ligne_integral"
                titre={LIBELLE_MODE_PAIEMENT.en_ligne_integral}
                detail="La totalité est retenue en séquestre. Vous confirmez la réception, Akora verse."
                desactive={!paiementEnLignePossible}
              />
            </GroupeRadio>
          </div>
        </Carte>

        <Carte className="p-4">
          <h2 className="text-produit">4. Récapitulatif</h2>
          <ul className="mt-3 divide-y divide-border">
            {groupes.map((groupe) => {
              const l = livraisons.get(groupe.fournisseurId);
              const livraison = l?.statut === "estimee" ? l.cout : 0;
              return (
                <li key={groupe.fournisseurId} className="py-2.5">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <BadgeVerification niveau={groupe.fournisseurNiveau} compact />
                    {groupe.fournisseurNom}
                  </p>
                  <dl className="mt-1 space-y-0.5 text-legende">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {groupe.lignes.length} ligne{groupe.lignes.length > 1 ? "s" : ""}
                      </dt>
                      <dd className="nombres">{formaterAriary(groupe.montantProduits)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Livraison</dt>
                      <dd className="nombres">
                        {l?.statut === "offerte"
                          ? "offerte"
                          : l?.statut === "estimee"
                            ? formaterAriary(livraison)
                            : "à confirmer"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-baseline justify-between gap-2 border-t border-border pt-3">
            <span className="font-semibold">Total</span>
            <span className="nombres text-[1.375rem] font-bold text-primary">
              {formaterAriary(totalGeneral)}
            </span>
          </p>
          <p className="mt-1 text-[0.78rem] text-muted-foreground">
            Les montants sont recalculés par Akora au moment de l'envoi, depuis les prix en base.
          </p>

          <Bouton className="mt-3" pleineLargeur taille="large" disabled={enCours} onClick={() => void envoyer()}>
            {enCours ? "Envoi en cours" : "Envoyer ma commande"}
          </Bouton>
        </Carte>
      </div>
    </div>
  );
}
