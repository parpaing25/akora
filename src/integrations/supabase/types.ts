// Fichier GENERE par `npm run types:gen`. Ne pas modifier a la main.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abonnements: {
        Row: {
          created_at: string
          fournisseur_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fournisseur_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          fournisseur_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "abonnements_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "abonnements_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      abonnements_push: {
        Row: {
          agent: string | null
          cle_auth: string
          cle_p256dh: string
          created_at: string
          endpoint: string
          id: string
          user_id: string
          vu_le: string
        }
        Insert: {
          agent?: string | null
          cle_auth: string
          cle_p256dh: string
          created_at?: string
          endpoint: string
          id?: string
          user_id: string
          vu_le?: string
        }
        Update: {
          agent?: string | null
          cle_auth?: string
          cle_p256dh?: string
          created_at?: string
          endpoint?: string
          id?: string
          user_id?: string
          vu_le?: string
        }
        Relationships: []
      }
      adresses_chantier: {
        Row: {
          adresse_libre: string | null
          created_at: string
          id: string
          lat: number | null
          libelle: string
          lng: number | null
          localite_id: string | null
          par_defaut: boolean
          user_id: string
        }
        Insert: {
          adresse_libre?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          libelle: string
          lng?: number | null
          localite_id?: string | null
          par_defaut?: boolean
          user_id: string
        }
        Update: {
          adresse_libre?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          libelle?: string
          lng?: number | null
          localite_id?: string | null
          par_defaut?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adresses_chantier_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acteur_id: string | null
          action: string
          agent: string | null
          apres: Json | null
          avant: Json | null
          created_at: string
          entite: string
          entite_id: string | null
          id: number
          ip: unknown
        }
        Insert: {
          acteur_id?: string | null
          action: string
          agent?: string | null
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          entite: string
          entite_id?: string | null
          id?: number
          ip?: unknown
        }
        Update: {
          acteur_id?: string | null
          action?: string
          agent?: string | null
          apres?: Json | null
          avant?: Json | null
          created_at?: string
          entite?: string
          entite_id?: string | null
          id?: number
          ip?: unknown
        }
        Relationships: []
      }
      avis: {
        Row: {
          auteur_id: string
          commande_id: string
          commentaire: string | null
          created_at: string
          fournisseur_id: string
          id: string
          note: number
          reponse_fournisseur: string | null
          statut: Database["public"]["Enums"]["statut_moderation"]
          updated_at: string
        }
        Insert: {
          auteur_id: string
          commande_id: string
          commentaire?: string | null
          created_at?: string
          fournisseur_id: string
          id?: string
          note: number
          reponse_fournisseur?: string | null
          statut?: Database["public"]["Enums"]["statut_moderation"]
          updated_at?: string
        }
        Update: {
          auteur_id?: string
          commande_id?: string
          commentaire?: string | null
          created_at?: string
          fournisseur_id?: string
          id?: string
          note?: number
          reponse_fournisseur?: string | null
          statut?: Database["public"]["Enums"]["statut_moderation"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avis_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: true
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "avis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "avis_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          icone: string | null
          id: string
          nom: string
          nom_mg: string | null
          ordre: number
          parent_id: string | null
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          nom: string
          nom_mg?: string | null
          ordre?: number
          parent_id?: string | null
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icone?: string | null
          id?: string
          nom?: string
          nom_mg?: string | null
          ordre?: number
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      codes_verification_email: {
        Row: {
          code: string
          created_at: string
          email: string
          expire_le: string
          id: string
          tentatives: number
          usage: string
          user_id: string | null
          verifie: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expire_le: string
          id?: string
          tentatives?: number
          usage?: string
          user_id?: string | null
          verifie?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expire_le?: string
          id?: string
          tentatives?: number
          usage?: string
          user_id?: string | null
          verifie?: boolean
        }
        Relationships: []
      }
      commandes: {
        Row: {
          acheteur_id: string | null
          adresse_libre: string | null
          cloturee_le: string | null
          confirmee_le: string | null
          created_at: string
          distance_km: number | null
          email_contact: string | null
          fournisseur_id: string
          id: string
          lat: number | null
          livraison_estimable: boolean
          livree_le: string | null
          lng: number | null
          localite_id: string | null
          message: string | null
          mode_paiement: Database["public"]["Enums"]["mode_paiement"]
          montant_commission: number
          montant_livraison: number
          montant_produits: number
          montant_total: number
          nb_rotations: number
          nom_contact: string
          numero: string
          statut: Database["public"]["Enums"]["statut_commande"]
          telephone_contact: string
          updated_at: string
          vehicule_id: string | null
          vue_le: string | null
        }
        Insert: {
          acheteur_id?: string | null
          adresse_libre?: string | null
          cloturee_le?: string | null
          confirmee_le?: string | null
          created_at?: string
          distance_km?: number | null
          email_contact?: string | null
          fournisseur_id: string
          id?: string
          lat?: number | null
          livraison_estimable?: boolean
          livree_le?: string | null
          lng?: number | null
          localite_id?: string | null
          message?: string | null
          mode_paiement?: Database["public"]["Enums"]["mode_paiement"]
          montant_commission?: number
          montant_livraison?: number
          montant_produits?: number
          montant_total?: number
          nb_rotations?: number
          nom_contact: string
          numero: string
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_contact: string
          updated_at?: string
          vehicule_id?: string | null
          vue_le?: string | null
        }
        Update: {
          acheteur_id?: string | null
          adresse_libre?: string | null
          cloturee_le?: string | null
          confirmee_le?: string | null
          created_at?: string
          distance_km?: number | null
          email_contact?: string | null
          fournisseur_id?: string
          id?: string
          lat?: number | null
          livraison_estimable?: boolean
          livree_le?: string | null
          lng?: number | null
          localite_id?: string | null
          message?: string | null
          mode_paiement?: Database["public"]["Enums"]["mode_paiement"]
          montant_commission?: number
          montant_livraison?: number
          montant_produits?: number
          montant_total?: number
          nb_rotations?: number
          nom_contact?: string
          numero?: string
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_contact?: string
          updated_at?: string
          vehicule_id?: string | null
          vue_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "commandes_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_vehicule_id_fkey"
            columns: ["vehicule_id"]
            isOneToOne: false
            referencedRelation: "vehicules_livraison"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          actif_au: string | null
          actif_du: string
          categorie_id: string | null
          created_at: string
          id: string
          taux_pct: number
        }
        Insert: {
          actif_au?: string | null
          actif_du?: string
          categorie_id?: string | null
          created_at?: string
          id?: string
          taux_pct: number
        }
        Update: {
          actif_au?: string | null
          actif_du?: string
          categorie_id?: string | null
          created_at?: string
          id?: string
          taux_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs_commande: {
        Row: {
          dernier: number
          periode: string
        }
        Insert: {
          dernier?: number
          periode: string
        }
        Update: {
          dernier?: number
          periode?: string
        }
        Relationships: []
      }
      demandes: {
        Row: {
          created_at: string
          date_souhaitee: string | null
          expire_le: string
          id: string
          lat: number | null
          libelle_lieu: string | null
          lng: number | null
          localite_id: string | null
          note: string | null
          publication_id: string | null
          statut: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_souhaitee?: string | null
          expire_le?: string
          id?: string
          lat?: number | null
          libelle_lieu?: string | null
          lng?: number | null
          localite_id?: string | null
          note?: string | null
          publication_id?: string | null
          statut?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_souhaitee?: string | null
          expire_le?: string
          id?: string
          lat?: number | null
          libelle_lieu?: string | null
          lng?: number | null
          localite_id?: string | null
          note?: string | null
          publication_id?: string | null
          statut?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_lignes: {
        Row: {
          demande_id: string
          id: string
          materiau_ref_id: string
          ordre: number
          precision: string | null
          quantite: number
          unite: Database["public"]["Enums"]["unite"]
        }
        Insert: {
          demande_id: string
          id?: string
          materiau_ref_id: string
          ordre?: number
          precision?: string | null
          quantite: number
          unite: Database["public"]["Enums"]["unite"]
        }
        Update: {
          demande_id?: string
          id?: string
          materiau_ref_id?: string
          ordre?: number
          precision?: string | null
          quantite?: number
          unite?: Database["public"]["Enums"]["unite"]
        }
        Relationships: [
          {
            foreignKeyName: "demandes_lignes_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_lignes_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_lignes_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_materiau: {
        Row: {
          categorie_id: string
          created_at: string
          description: string | null
          fournisseur_id: string
          id: string
          materiau_ref_cree_id: string | null
          motif_refus: string | null
          nb_demandeurs: number
          nom_propose: string
          photo_url: string | null
          poids_kg_unite: number
          statut: Database["public"]["Enums"]["statut_demande_materiau"]
          unite: Database["public"]["Enums"]["unite"]
          updated_at: string
          volume_m3_unite: number
        }
        Insert: {
          categorie_id: string
          created_at?: string
          description?: string | null
          fournisseur_id: string
          id?: string
          materiau_ref_cree_id?: string | null
          motif_refus?: string | null
          nb_demandeurs?: number
          nom_propose: string
          photo_url?: string | null
          poids_kg_unite: number
          statut?: Database["public"]["Enums"]["statut_demande_materiau"]
          unite: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite: number
        }
        Update: {
          categorie_id?: string
          created_at?: string
          description?: string | null
          fournisseur_id?: string
          id?: string
          materiau_ref_cree_id?: string | null
          motif_refus?: string | null
          nb_demandeurs?: number
          nom_propose?: string
          photo_url?: string | null
          poids_kg_unite?: number
          statut?: Database["public"]["Enums"]["statut_demande_materiau"]
          unite?: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite?: number
        }
        Relationships: [
          {
            foreignKeyName: "demandes_materiau_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_materiau_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "demandes_materiau_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_materiau_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_materiau_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "demandes_materiau_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_materiau_materiau_ref_cree_id_fkey"
            columns: ["materiau_ref_cree_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_materiau_materiau_ref_cree_id_fkey"
            columns: ["materiau_ref_cree_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_fournisseur: {
        Row: {
          chemin_bucket: string | null
          created_at: string
          expire_le: string | null
          fournisseur_id: string
          id: string
          motif_refus: string | null
          numero: string | null
          statut: Database["public"]["Enums"]["statut_document"]
          type: Database["public"]["Enums"]["type_document"]
          updated_at: string
          valide_le: string | null
          valide_par: string | null
        }
        Insert: {
          chemin_bucket?: string | null
          created_at?: string
          expire_le?: string | null
          fournisseur_id: string
          id?: string
          motif_refus?: string | null
          numero?: string | null
          statut?: Database["public"]["Enums"]["statut_document"]
          type: Database["public"]["Enums"]["type_document"]
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Update: {
          chemin_bucket?: string | null
          created_at?: string
          expire_le?: string | null
          fournisseur_id?: string
          id?: string
          motif_refus?: string | null
          numero?: string | null
          statut?: Database["public"]["Enums"]["statut_document"]
          type?: Database["public"]["Enums"]["type_document"]
          updated_at?: string
          valide_le?: string | null
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "documents_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "documents_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      favoris: {
        Row: {
          created_at: string
          fournisseur_id: string | null
          id: string
          produit_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fournisseur_id?: string | null
          id?: string
          produit_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fournisseur_id?: string | null
          id?: string
          produit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoris_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "favoris_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "favoris_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseur_membres: {
        Row: {
          created_at: string
          fournisseur_id: string
          id: string
          role_interne: Database["public"]["Enums"]["role_interne"]
          user_id: string
        }
        Insert: {
          created_at?: string
          fournisseur_id: string
          id?: string
          role_interne?: Database["public"]["Enums"]["role_interne"]
          user_id: string
        }
        Update: {
          created_at?: string
          fournisseur_id?: string
          id?: string
          role_interne?: Database["public"]["Enums"]["role_interne"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseur_membres_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "fournisseur_membres_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fournisseur_membres_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fournisseur_membres_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "fournisseur_membres_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          adresse: string | null
          assujetti_tva: boolean
          coef_sinuosite: number | null
          couverture_url: string | null
          created_at: string
          description: string | null
          email: string | null
          horaires: Json
          id: string
          lat: number | null
          lng: number | null
          localite_id: string | null
          logo_url: string | null
          metier: string | null
          modes_paiement_acceptes: Database["public"]["Enums"]["mode_paiement"][]
          msisdn_versement: string | null
          nature: string
          nb_avis: number
          nb_commandes_cloturees: number
          nif: string | null
          niveau_verification: Database["public"]["Enums"]["niveau_verification"]
          note_moyenne: number | null
          operateur_versement:
            | Database["public"]["Enums"]["operateur_paiement"]
            | null
          owner_id: string
          photo_depot: string | null
          raison_sociale: string
          rayon_max_km: number
          rcs: string | null
          retrait_sur_place: boolean
          slug: string
          stat: string | null
          statut: Database["public"]["Enums"]["statut_fournisseur"]
          taux_acompte: number
          telephone: string | null
          updated_at: string
          verifie_le: string | null
          whatsapp: string | null
        }
        Insert: {
          adresse?: string | null
          assujetti_tva?: boolean
          coef_sinuosite?: number | null
          couverture_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          horaires?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          localite_id?: string | null
          logo_url?: string | null
          metier?: string | null
          modes_paiement_acceptes?: Database["public"]["Enums"]["mode_paiement"][]
          msisdn_versement?: string | null
          nature?: string
          nb_avis?: number
          nb_commandes_cloturees?: number
          nif?: string | null
          niveau_verification?: Database["public"]["Enums"]["niveau_verification"]
          note_moyenne?: number | null
          operateur_versement?:
            | Database["public"]["Enums"]["operateur_paiement"]
            | null
          owner_id: string
          photo_depot?: string | null
          raison_sociale: string
          rayon_max_km?: number
          rcs?: string | null
          retrait_sur_place?: boolean
          slug: string
          stat?: string | null
          statut?: Database["public"]["Enums"]["statut_fournisseur"]
          taux_acompte?: number
          telephone?: string | null
          updated_at?: string
          verifie_le?: string | null
          whatsapp?: string | null
        }
        Update: {
          adresse?: string | null
          assujetti_tva?: boolean
          coef_sinuosite?: number | null
          couverture_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          horaires?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          localite_id?: string | null
          logo_url?: string | null
          metier?: string | null
          modes_paiement_acceptes?: Database["public"]["Enums"]["mode_paiement"][]
          msisdn_versement?: string | null
          nature?: string
          nb_avis?: number
          nb_commandes_cloturees?: number
          nif?: string | null
          niveau_verification?: Database["public"]["Enums"]["niveau_verification"]
          note_moyenne?: number | null
          operateur_versement?:
            | Database["public"]["Enums"]["operateur_paiement"]
            | null
          owner_id?: string
          photo_depot?: string | null
          raison_sociale?: string
          rayon_max_km?: number
          rcs?: string | null
          retrait_sur_place?: boolean
          slug?: string
          stat?: string | null
          statut?: Database["public"]["Enums"]["statut_fournisseur"]
          taux_acompte?: number
          telephone?: string | null
          updated_at?: string
          verifie_le?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger: {
        Row: {
          commande_id: string | null
          created_at: string
          fournisseur_id: string
          id: number
          libelle: string
          montant: number
          paiement_id: string | null
          retrait_id: string | null
          solde_apres: number
          type: Database["public"]["Enums"]["type_ecriture"]
        }
        Insert: {
          commande_id?: string | null
          created_at?: string
          fournisseur_id: string
          id?: number
          libelle: string
          montant: number
          paiement_id?: string | null
          retrait_id?: string | null
          solde_apres: number
          type: Database["public"]["Enums"]["type_ecriture"]
        }
        Update: {
          commande_id?: string | null
          created_at?: string
          fournisseur_id?: string
          id?: number
          libelle?: string
          montant?: number
          paiement_id?: string | null
          retrait_id?: string | null
          solde_apres?: number
          type?: Database["public"]["Enums"]["type_ecriture"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "ledger_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "ledger_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_retrait_fk"
            columns: ["retrait_id"]
            isOneToOne: false
            referencedRelation: "retraits"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_commande: {
        Row: {
          commande_id: string
          designation_snapshot: string
          id: string
          prix_unitaire_snapshot: number
          produit_id: string | null
          quantite: number
          total_ligne: number
          unite_snapshot: Database["public"]["Enums"]["unite"]
        }
        Insert: {
          commande_id: string
          designation_snapshot: string
          id?: string
          prix_unitaire_snapshot: number
          produit_id?: string | null
          quantite: number
          total_ligne: number
          unite_snapshot: Database["public"]["Enums"]["unite"]
        }
        Update: {
          commande_id?: string
          designation_snapshot?: string
          id?: string
          prix_unitaire_snapshot?: number
          produit_id?: string | null
          quantite?: number
          total_ligne?: number
          unite_snapshot?: Database["public"]["Enums"]["unite"]
        }
        Relationships: [
          {
            foreignKeyName: "lignes_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_commande_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_commande_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      litiges: {
        Row: {
          arbitre_par: string | null
          commande_id: string
          created_at: string
          decision: string | null
          description: string | null
          id: string
          montant_rembourse: number | null
          motif: string
          ouvert_par: string
          photos: string[]
          statut: Database["public"]["Enums"]["statut_litige"]
          updated_at: string
        }
        Insert: {
          arbitre_par?: string | null
          commande_id: string
          created_at?: string
          decision?: string | null
          description?: string | null
          id?: string
          montant_rembourse?: number | null
          motif: string
          ouvert_par: string
          photos?: string[]
          statut?: Database["public"]["Enums"]["statut_litige"]
          updated_at?: string
        }
        Update: {
          arbitre_par?: string | null
          commande_id?: string
          created_at?: string
          decision?: string | null
          description?: string | null
          id?: string
          montant_rembourse?: number | null
          motif?: string
          ouvert_par?: string
          photos?: string[]
          statut?: Database["public"]["Enums"]["statut_litige"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "litiges_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      localites: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          nom: string
          parent_id: string | null
          slug: string
          type: Database["public"]["Enums"]["type_localite"]
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nom: string
          parent_id?: string | null
          slug: string
          type: Database["public"]["Enums"]["type_localite"]
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nom?: string
          parent_id?: string | null
          slug?: string
          type?: Database["public"]["Enums"]["type_localite"]
        }
        Relationships: [
          {
            foreignKeyName: "localites_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      materiaux_ref: {
        Row: {
          actif: boolean
          attributs: Json
          categorie_id: string
          created_at: string
          diametre_mm: number | null
          dimensions: string | null
          epaisseur_cm: number | null
          id: string
          largeur_cm: number | null
          libelle_court: string | null
          longueur_cm: number | null
          nom: string
          note: string | null
          ordre_format: number | null
          photo: string | null
          poids_kg_unite_defaut: number
          prix_indicatif_le: string | null
          prix_indicatif_max: number | null
          prix_indicatif_min: number | null
          prix_indicatif_source: string | null
          slug: string
          type_id: string | null
          unite_defaut: Database["public"]["Enums"]["unite"]
          updated_at: string
          volume_m3_unite_defaut: number
        }
        Insert: {
          actif?: boolean
          attributs?: Json
          categorie_id: string
          created_at?: string
          diametre_mm?: number | null
          dimensions?: string | null
          epaisseur_cm?: number | null
          id?: string
          largeur_cm?: number | null
          libelle_court?: string | null
          longueur_cm?: number | null
          nom: string
          note?: string | null
          ordre_format?: number | null
          photo?: string | null
          poids_kg_unite_defaut: number
          prix_indicatif_le?: string | null
          prix_indicatif_max?: number | null
          prix_indicatif_min?: number | null
          prix_indicatif_source?: string | null
          slug: string
          type_id?: string | null
          unite_defaut: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite_defaut: number
        }
        Update: {
          actif?: boolean
          attributs?: Json
          categorie_id?: string
          created_at?: string
          diametre_mm?: number | null
          dimensions?: string | null
          epaisseur_cm?: number | null
          id?: string
          largeur_cm?: number | null
          libelle_court?: string | null
          longueur_cm?: number | null
          nom?: string
          note?: string | null
          ordre_format?: number | null
          photo?: string | null
          poids_kg_unite_defaut?: number
          prix_indicatif_le?: string | null
          prix_indicatif_max?: number | null
          prix_indicatif_min?: number | null
          prix_indicatif_source?: string | null
          slug?: string
          type_id?: string | null
          unite_defaut?: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite_defaut?: number
        }
        Relationships: [
          {
            foreignKeyName: "materiaux_ref_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiaux_ref_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "types_materiaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiaux_ref_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "types_vitrine"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          categorie: string
          corps: string | null
          created_at: string
          id: string
          lien: string | null
          lue: boolean
          poussee_le: string | null
          titre: string
          user_id: string
        }
        Insert: {
          categorie?: string
          corps?: string | null
          created_at?: string
          id?: string
          lien?: string | null
          lue?: boolean
          poussee_le?: string | null
          titre: string
          user_id: string
        }
        Update: {
          categorie?: string
          corps?: string | null
          created_at?: string
          id?: string
          lien?: string | null
          lue?: boolean
          poussee_le?: string | null
          titre?: string
          user_id?: string
        }
        Relationships: []
      }
      paiements: {
        Row: {
          cle_idempotence: string
          commande_id: string
          confirme_le: string | null
          id: string
          initie_le: string
          libere_le: string | null
          mode: Database["public"]["Enums"]["mode_paiement"]
          montant: number
          msisdn: string | null
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          payload_brut: Json | null
          reference_externe: string | null
          reference_saisie: string | null
          statut: Database["public"]["Enums"]["statut_paiement"]
          updated_at: string
        }
        Insert: {
          cle_idempotence: string
          commande_id: string
          confirme_le?: string | null
          id?: string
          initie_le?: string
          libere_le?: string | null
          mode: Database["public"]["Enums"]["mode_paiement"]
          montant: number
          msisdn?: string | null
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          payload_brut?: Json | null
          reference_externe?: string | null
          reference_saisie?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          updated_at?: string
        }
        Update: {
          cle_idempotence?: string
          commande_id?: string
          confirme_le?: string | null
          id?: string
          initie_le?: string
          libere_le?: string | null
          mode?: Database["public"]["Enums"]["mode_paiement"]
          montant?: number
          msisdn?: string | null
          operateur?: Database["public"]["Enums"]["operateur_paiement"]
          payload_brut?: Json | null
          reference_externe?: string | null
          reference_saisie?: string | null
          statut?: Database["public"]["Enums"]["statut_paiement"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres: {
        Row: {
          cle: string
          description: string | null
          updated_at: string
          valeur: Json
        }
        Insert: {
          cle: string
          description?: string | null
          updated_at?: string
          valeur: Json
        }
        Update: {
          cle?: string
          description?: string | null
          updated_at?: string
          valeur?: Json
        }
        Relationships: []
      }
      portefeuilles: {
        Row: {
          fournisseur_id: string
          maj_le: string
          solde_disponible: number
          solde_sequestre: number
        }
        Insert: {
          fournisseur_id: string
          maj_le?: string
          solde_disponible?: number
          solde_sequestre?: number
        }
        Update: {
          fournisseur_id?: string
          maj_le?: string
          solde_disponible?: number
          solde_sequestre?: number
        }
        Relationships: [
          {
            foreignKeyName: "portefeuilles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: true
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "portefeuilles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: true
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portefeuilles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: true
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portefeuilles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: true
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "portefeuilles_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: true
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      prix_historique: {
        Row: {
          id: number
          prix_unitaire: number
          produit_id: string
          releve_le: string
        }
        Insert: {
          id?: number
          prix_unitaire: number
          produit_id: string
          releve_le?: string
        }
        Update: {
          id?: number
          prix_unitaire?: number
          produit_id?: string
          releve_le?: string
        }
        Relationships: [
          {
            foreignKeyName: "prix_historique_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prix_historique_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      produits: {
        Row: {
          caracteristiques: Json
          categorie_id: string
          created_at: string
          delai_preparation_jours: number
          demande_materiau_id: string | null
          description: string | null
          fournisseur_id: string
          id: string
          materiau_ref_id: string | null
          nom_affiche: string
          photos: string[]
          poids_kg_unite: number
          prix_maj_le: string
          prix_promo: number | null
          prix_unitaire: number
          quantite_min: number
          slug: string
          statut: Database["public"]["Enums"]["statut_produit"]
          stock_statut: Database["public"]["Enums"]["stock_statut"]
          tva_taux: number
          unite: Database["public"]["Enums"]["unite"]
          updated_at: string
          volume_m3_unite: number
        }
        Insert: {
          caracteristiques?: Json
          categorie_id: string
          created_at?: string
          delai_preparation_jours?: number
          demande_materiau_id?: string | null
          description?: string | null
          fournisseur_id: string
          id?: string
          materiau_ref_id?: string | null
          nom_affiche: string
          photos?: string[]
          poids_kg_unite: number
          prix_maj_le?: string
          prix_promo?: number | null
          prix_unitaire: number
          quantite_min?: number
          slug: string
          statut?: Database["public"]["Enums"]["statut_produit"]
          stock_statut?: Database["public"]["Enums"]["stock_statut"]
          tva_taux?: number
          unite: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite: number
        }
        Update: {
          caracteristiques?: Json
          categorie_id?: string
          created_at?: string
          delai_preparation_jours?: number
          demande_materiau_id?: string | null
          description?: string | null
          fournisseur_id?: string
          id?: string
          materiau_ref_id?: string | null
          nom_affiche?: string
          photos?: string[]
          poids_kg_unite?: number
          prix_maj_le?: string
          prix_promo?: number | null
          prix_unitaire?: number
          quantite_min?: number
          slug?: string
          statut?: Database["public"]["Enums"]["statut_produit"]
          stock_statut?: Database["public"]["Enums"]["stock_statut"]
          tva_taux?: number
          unite?: Database["public"]["Enums"]["unite"]
          updated_at?: string
          volume_m3_unite?: number
        }
        Relationships: [
          {
            foreignKeyName: "produits_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_demande_materiau_id_fkey"
            columns: ["demande_materiau_id"]
            isOneToOne: false
            referencedRelation: "demandes_materiau"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "produits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      produits_paliers: {
        Row: {
          id: string
          prix_unitaire: number
          produit_id: string
          quantite_min: number
        }
        Insert: {
          id?: string
          prix_unitaire: number
          produit_id: string
          quantite_min: number
        }
        Update: {
          id?: string
          prix_unitaire?: number
          produit_id?: string
          quantite_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "produits_paliers_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_paliers_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email_verifie: boolean
          email_verifie_le: string | null
          id: string
          nif: string | null
          nom_complet: string | null
          raison_sociale: string | null
          telephone: string | null
          type_client: Database["public"]["Enums"]["type_client"]
          updated_at: string
          ville: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_verifie?: boolean
          email_verifie_le?: string | null
          id: string
          nif?: string | null
          nom_complet?: string | null
          raison_sociale?: string | null
          telephone?: string | null
          type_client?: Database["public"]["Enums"]["type_client"]
          updated_at?: string
          ville?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_verifie?: boolean
          email_verifie_le?: string | null
          id?: string
          nif?: string | null
          nom_complet?: string | null
          raison_sociale?: string | null
          telephone?: string | null
          type_client?: Database["public"]["Enums"]["type_client"]
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      propositions: {
        Row: {
          created_at: string
          delai_jours: number | null
          demande_id: string
          fournisseur_id: string
          id: string
          livraison: number | null
          message: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delai_jours?: number | null
          demande_id: string
          fournisseur_id: string
          id?: string
          livraison?: number | null
          message?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delai_jours?: number | null
          demande_id?: string
          fournisseur_id?: string
          id?: string
          livraison?: number | null
          message?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "propositions_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "propositions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "propositions_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      propositions_lignes: {
        Row: {
          disponible: boolean
          ligne_id: string
          prix_unitaire: number | null
          proposition_id: string
        }
        Insert: {
          disponible?: boolean
          ligne_id: string
          prix_unitaire?: number | null
          proposition_id: string
        }
        Update: {
          disponible?: boolean
          ligne_id?: string
          prix_unitaire?: number | null
          proposition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propositions_lignes_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "demandes_lignes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_lignes_proposition_id_fkey"
            columns: ["proposition_id"]
            isOneToOne: false
            referencedRelation: "propositions"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects_fournisseurs: {
        Row: {
          adresse: string | null
          created_at: string
          fournisseur_id: string | null
          id: string
          jeton: string
          langue: string
          lat: number | null
          lng: number | null
          localite_id: string | null
          metier: string | null
          nature: string
          nb_vues: number
          page_url: string | null
          photos: string[]
          quartier: string | null
          raison_sociale: string
          rayon_km: number | null
          reserve_le: string
          revendique_le: string | null
          score: number | null
          seuil_franco: number | null
          source: string
          source_url: string | null
          statut: string
          telephone: string | null
          updated_at: string
          ville: string | null
          vue_le: string | null
          whatsapp: boolean
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          fournisseur_id?: string | null
          id?: string
          jeton: string
          langue?: string
          lat?: number | null
          lng?: number | null
          localite_id?: string | null
          metier?: string | null
          nature?: string
          nb_vues?: number
          page_url?: string | null
          photos?: string[]
          quartier?: string | null
          raison_sociale: string
          rayon_km?: number | null
          reserve_le?: string
          revendique_le?: string | null
          score?: number | null
          seuil_franco?: number | null
          source?: string
          source_url?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
          ville?: string | null
          vue_le?: string | null
          whatsapp?: boolean
        }
        Update: {
          adresse?: string | null
          created_at?: string
          fournisseur_id?: string | null
          id?: string
          jeton?: string
          langue?: string
          lat?: number | null
          lng?: number | null
          localite_id?: string | null
          metier?: string | null
          nature?: string
          nb_vues?: number
          page_url?: string | null
          photos?: string[]
          quartier?: string | null
          raison_sociale?: string
          rayon_km?: number | null
          reserve_le?: string
          revendique_le?: string | null
          score?: number | null
          seuil_franco?: number | null
          source?: string
          source_url?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
          ville?: string | null
          vue_le?: string | null
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "prospects_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "prospects_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "prospects_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_fournisseurs_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects_produits: {
        Row: {
          created_at: string
          id: string
          libelle: string
          materiau_ref_id: string
          ordre: number
          prix_unitaire: number | null
          prospect_id: string
          quantite_min: number | null
          unite: Database["public"]["Enums"]["unite"] | null
        }
        Insert: {
          created_at?: string
          id?: string
          libelle: string
          materiau_ref_id: string
          ordre?: number
          prix_unitaire?: number | null
          prospect_id: string
          quantite_min?: number | null
          unite?: Database["public"]["Enums"]["unite"] | null
        }
        Update: {
          created_at?: string
          id?: string
          libelle?: string
          materiau_ref_id?: string
          ordre?: number
          prix_unitaire?: number | null
          prospect_id?: string
          quantite_min?: number | null
          unite?: Database["public"]["Enums"]["unite"] | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_produits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects_fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects_vehicules: {
        Row: {
          aller_retour: boolean
          capacite_kg: number | null
          capacite_m3: number | null
          categorie: string | null
          created_at: string
          forfait_base: number | null
          id: string
          km_inclus: number | null
          marque: string | null
          materiaux_acceptes: string[]
          nb_roues: number | null
          nom: string
          ordre: number
          photo_url: string | null
          prix_minimum: number | null
          prix_par_km: number | null
          prospect_id: string
        }
        Insert: {
          aller_retour?: boolean
          capacite_kg?: number | null
          capacite_m3?: number | null
          categorie?: string | null
          created_at?: string
          forfait_base?: number | null
          id?: string
          km_inclus?: number | null
          marque?: string | null
          materiaux_acceptes?: string[]
          nb_roues?: number | null
          nom: string
          ordre?: number
          photo_url?: string | null
          prix_minimum?: number | null
          prix_par_km?: number | null
          prospect_id: string
        }
        Update: {
          aller_retour?: boolean
          capacite_kg?: number | null
          capacite_m3?: number | null
          categorie?: string | null
          created_at?: string
          forfait_base?: number | null
          id?: string
          km_inclus?: number | null
          marque?: string | null
          materiaux_acceptes?: string[]
          nb_roues?: number | null
          nom?: string
          ordre?: number
          photo_url?: string | null
          prix_minimum?: number | null
          prix_par_km?: number | null
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_vehicules_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects_fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_produits: {
        Row: {
          ordre: number
          produit_id: string
          publication_id: string
        }
        Insert: {
          ordre?: number
          produit_id: string
          publication_id: string
        }
        Update: {
          ordre?: number
          produit_id?: string
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_produits_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_produits_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_produits_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_produits_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          auteur_id: string | null
          created_at: string
          epingle: boolean
          expire_le: string | null
          fournisseur_id: string | null
          id: string
          localite_id: string | null
          photos: string[]
          publie_le: string
          statut: Database["public"]["Enums"]["statut_publication"]
          texte: string
          type: Database["public"]["Enums"]["type_publication"]
          updated_at: string
        }
        Insert: {
          auteur_id?: string | null
          created_at?: string
          epingle?: boolean
          expire_le?: string | null
          fournisseur_id?: string | null
          id?: string
          localite_id?: string | null
          photos?: string[]
          publie_le?: string
          statut?: Database["public"]["Enums"]["statut_publication"]
          texte: string
          type: Database["public"]["Enums"]["type_publication"]
          updated_at?: string
        }
        Update: {
          auteur_id?: string | null
          created_at?: string
          epingle?: boolean
          expire_le?: string | null
          fournisseur_id?: string | null
          id?: string
          localite_id?: string | null
          photos?: string[]
          publie_le?: string
          statut?: Database["public"]["Enums"]["statut_publication"]
          texte?: string
          type?: Database["public"]["Enums"]["type_publication"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "publications_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "publications_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          cle: string
          compteur: number
          fenetre: string
          id: number
          sujet: string
        }
        Insert: {
          cle: string
          compteur?: number
          fenetre: string
          id?: number
          sujet: string
        }
        Update: {
          cle?: string
          compteur?: number
          fenetre?: string
          id?: number
          sujet?: string
        }
        Relationships: []
      }
      ratios_metre: {
        Row: {
          calculateur: string
          cle: string
          id: string
          libelle: string
          note: string | null
          unite: string
          updated_at: string
          valeur: number
        }
        Insert: {
          calculateur: string
          cle: string
          id?: string
          libelle: string
          note?: string | null
          unite: string
          updated_at?: string
          valeur: number
        }
        Update: {
          calculateur?: string
          cle?: string
          id?: string
          libelle?: string
          note?: string | null
          unite?: string
          updated_at?: string
          valeur?: number
        }
        Relationships: []
      }
      releves_prix: {
        Row: {
          cree_le: string
          empreinte_depot: string | null
          id: string
          libelle_brut: string | null
          localite_id: string | null
          materiau_ref_id: string | null
          prix: number
          releve_le: string
          source: string
          unite: Database["public"]["Enums"]["unite"] | null
        }
        Insert: {
          cree_le?: string
          empreinte_depot?: string | null
          id?: string
          libelle_brut?: string | null
          localite_id?: string | null
          materiau_ref_id?: string | null
          prix: number
          releve_le?: string
          source?: string
          unite?: Database["public"]["Enums"]["unite"] | null
        }
        Update: {
          cree_le?: string
          empreinte_depot?: string | null
          id?: string
          libelle_brut?: string | null
          localite_id?: string | null
          materiau_ref_id?: string | null
          prix?: number
          releve_le?: string
          source?: string
          unite?: Database["public"]["Enums"]["unite"] | null
        }
        Relationships: [
          {
            foreignKeyName: "releves_prix_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_prix_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_prix_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      retraits: {
        Row: {
          demande_le: string
          fournisseur_id: string
          id: string
          montant: number
          motif_refus: string | null
          msisdn: string
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          reference: string | null
          statut: Database["public"]["Enums"]["statut_retrait"]
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          demande_le?: string
          fournisseur_id: string
          id?: string
          montant: number
          motif_refus?: string | null
          msisdn: string
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          reference?: string | null
          statut?: Database["public"]["Enums"]["statut_retrait"]
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          demande_le?: string
          fournisseur_id?: string
          id?: string
          montant?: number
          motif_refus?: string | null
          msisdn?: string
          operateur?: Database["public"]["Enums"]["operateur_paiement"]
          reference?: string | null
          statut?: Database["public"]["Enums"]["statut_retrait"]
          traite_le?: string | null
          traite_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retraits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "retraits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retraits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retraits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "retraits_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          created_at: string
          description: string | null
          entite: string
          entite_id: string
          id: string
          motif: string
          signale_par: string | null
          traite: boolean
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entite: string
          entite_id: string
          id?: string
          motif: string
          signale_par?: string | null
          traite?: boolean
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entite?: string
          entite_id?: string
          id?: string
          motif?: string
          signale_par?: string | null
          traite?: boolean
          traite_le?: string | null
          traite_par?: string | null
        }
        Relationships: []
      }
      types_materiaux: {
        Row: {
          actif: boolean
          categorie_id: string
          created_at: string
          description: string | null
          id: string
          nom: string
          nom_mg: string | null
          ordre: number
          photo: string | null
          slug: string
          synonymes: string[]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie_id: string
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          nom_mg?: string | null
          ordre?: number
          photo?: string | null
          slug: string
          synonymes?: string[]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie_id?: string
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          nom_mg?: string | null
          ordre?: number
          photo?: string | null
          slug?: string
          synonymes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "types_materiaux_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicules_livraison: {
        Row: {
          actif: boolean
          capacite_kg: number
          capacite_m3: number
          categorie: string | null
          created_at: string
          facturer_aller_retour: boolean
          forfait_base: number
          fournisseur_id: string
          id: string
          km_inclus: number
          marque: string | null
          materiaux_acceptes: string[]
          modele: string | null
          nb_roues: number | null
          nom: string
          ordre: number
          photo_url: string | null
          prix_minimum: number
          prix_par_km: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          capacite_kg: number
          capacite_m3: number
          categorie?: string | null
          created_at?: string
          facturer_aller_retour?: boolean
          forfait_base?: number
          fournisseur_id: string
          id?: string
          km_inclus?: number
          marque?: string | null
          materiaux_acceptes?: string[]
          modele?: string | null
          nb_roues?: number | null
          nom: string
          ordre?: number
          photo_url?: string | null
          prix_minimum?: number
          prix_par_km?: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          capacite_kg?: number
          capacite_m3?: number
          categorie?: string | null
          created_at?: string
          facturer_aller_retour?: boolean
          forfait_base?: number
          fournisseur_id?: string
          id?: string
          km_inclus?: number
          marque?: string | null
          materiaux_acceptes?: string[]
          modele?: string | null
          nb_roues?: number | null
          nom?: string
          ordre?: number
          photo_url?: string | null
          prix_minimum?: number
          prix_par_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicules_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "vehicules_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicules_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "vehicules_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      vues_produit_jour: {
        Row: {
          jour: string
          produit_id: string
          vues: number
        }
        Insert: {
          jour: string
          produit_id: string
          vues?: number
        }
        Update: {
          jour?: string
          produit_id?: string
          vues?: number
        }
        Relationships: [
          {
            foreignKeyName: "vues_produit_jour_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vues_produit_jour_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks_recus: {
        Row: {
          erreur: string | null
          id: number
          id_evenement: string
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          payload: Json
          recu_le: string
          signature_valide: boolean
          traite: boolean
        }
        Insert: {
          erreur?: string | null
          id?: number
          id_evenement: string
          operateur: Database["public"]["Enums"]["operateur_paiement"]
          payload: Json
          recu_le?: string
          signature_valide?: boolean
          traite?: boolean
        }
        Update: {
          erreur?: string | null
          id?: number
          id_evenement?: string
          operateur?: Database["public"]["Enums"]["operateur_paiement"]
          payload?: Json
          recu_le?: string
          signature_valide?: boolean
          traite?: boolean
        }
        Relationships: []
      }
      zones_livraison: {
        Row: {
          actif: boolean
          created_at: string
          fournisseur_id: string
          id: string
          majoration_pct: number
          nom: string
          rayon_franco_km: number | null
          rayon_km: number
          seuil_franco: number | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          fournisseur_id: string
          id?: string
          majoration_pct?: number
          nom: string
          rayon_franco_km?: number | null
          rayon_km: number
          seuil_franco?: number | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          fournisseur_id?: string
          id?: string
          majoration_pct?: number
          nom?: string
          rayon_franco_km?: number | null
          rayon_km?: number
          seuil_franco?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fil_publications"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "zones_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs_publics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "produits_publics"
            referencedColumns: ["fournisseur_id"]
          },
          {
            foreignKeyName: "zones_livraison_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "transporteurs_publics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fil_publications: {
        Row: {
          epingle: boolean | null
          fournisseur_coef_sinuosite: number | null
          fournisseur_id: string | null
          fournisseur_lat: number | null
          fournisseur_lng: number | null
          fournisseur_nb_avis: number | null
          fournisseur_niveau:
            | Database["public"]["Enums"]["niveau_verification"]
            | null
          fournisseur_nom: string | null
          fournisseur_note: number | null
          fournisseur_rayon_max_km: number | null
          fournisseur_slug: string | null
          id: string | null
          localite_nom: string | null
          photos: string[] | null
          produits: Json | null
          publie_le: string | null
          suivi: boolean | null
          texte: string | null
          type: Database["public"]["Enums"]["type_publication"] | null
        }
        Relationships: []
      }
      formats_vitrine: {
        Row: {
          dimensions: string | null
          famille_nom: string | null
          famille_slug: string | null
          id: string | null
          libelle_court: string | null
          nb_offres: number | null
          nb_offres_verifiees: number | null
          nom: string | null
          note: string | null
          offre_coef_sinuosite: number | null
          offre_fournisseur_id: string | null
          offre_lat: number | null
          offre_lng: number | null
          offre_rayon_max_km: number | null
          ordre_format: number | null
          photo: string | null
          poids_kg_unite: number | null
          prix_des: number | null
          prix_indicatif_le: string | null
          prix_indicatif_max: number | null
          prix_indicatif_min: number | null
          prix_indicatif_source: string | null
          slug: string | null
          type_nom: string | null
          type_slug: string | null
          unite: Database["public"]["Enums"]["unite"] | null
          volume_m3_unite: number | null
        }
        Relationships: []
      }
      fournisseurs_publics: {
        Row: {
          assujetti_tva: boolean | null
          coef_sinuosite: number | null
          couverture_url: string | null
          created_at: string | null
          description: string | null
          horaires: Json | null
          id: string | null
          lat: number | null
          lng: number | null
          localite_id: string | null
          localite_nom: string | null
          logo_url: string | null
          metier: string | null
          modes_paiement_acceptes:
            | Database["public"]["Enums"]["mode_paiement"][]
            | null
          nature: string | null
          nb_avis: number | null
          nb_commandes_cloturees: number | null
          nif: string | null
          niveau_verification:
            | Database["public"]["Enums"]["niveau_verification"]
            | null
          note_moyenne: number | null
          photo_depot: string | null
          raison_sociale: string | null
          rayon_max_km: number | null
          rcs: string | null
          retrait_sur_place: boolean | null
          slug: string | null
          stat: string | null
          taux_acompte: number | null
          vehicules: string[] | null
          verifie_le: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      prix_marche: {
        Row: {
          dernier_releve: string | null
          localite_id: string | null
          materiau_ref_id: string | null
          nb_offres: number | null
          prix_max: number | null
          prix_median: number | null
          prix_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      produits_publics: {
        Row: {
          caracteristiques: Json | null
          categorie_id: string | null
          categorie_nom: string | null
          categorie_slug: string | null
          created_at: string | null
          delai_preparation_jours: number | null
          description: string | null
          fournisseur_assujetti_tva: boolean | null
          fournisseur_coef_sinuosite: number | null
          fournisseur_id: string | null
          fournisseur_lat: number | null
          fournisseur_lng: number | null
          fournisseur_localite_id: string | null
          fournisseur_modes_paiement:
            | Database["public"]["Enums"]["mode_paiement"][]
            | null
          fournisseur_nb_avis: number | null
          fournisseur_niveau:
            | Database["public"]["Enums"]["niveau_verification"]
            | null
          fournisseur_nom: string | null
          fournisseur_note: number | null
          fournisseur_rayon_max_km: number | null
          fournisseur_slug: string | null
          fournisseur_verifie_le: string | null
          id: string | null
          materiau_largeur_cm: number | null
          materiau_longueur_cm: number | null
          materiau_nom: string | null
          materiau_ref_id: string | null
          materiau_slug: string | null
          materiau_type_nom: string | null
          materiau_type_slug: string | null
          nom_affiche: string | null
          photos: string[] | null
          poids_kg_unite: number | null
          prix_maj_le: string | null
          prix_promo: number | null
          prix_unitaire: number | null
          quantite_min: number | null
          slug: string | null
          stock_statut: Database["public"]["Enums"]["stock_statut"] | null
          tva_taux: number | null
          unite: Database["public"]["Enums"]["unite"] | null
          volume_m3_unite: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_localite_id_fkey"
            columns: ["fournisseur_localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "formats_vitrine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_materiau_ref_id_fkey"
            columns: ["materiau_ref_id"]
            isOneToOne: false
            referencedRelation: "materiaux_ref"
            referencedColumns: ["id"]
          },
        ]
      }
      transporteurs_publics: {
        Row: {
          couverture_url: string | null
          description: string | null
          id: string | null
          lat: number | null
          lng: number | null
          localite_id: string | null
          localite_nom: string | null
          logo_url: string | null
          nature: string | null
          nb_avis: number | null
          niveau_verification:
            | Database["public"]["Enums"]["niveau_verification"]
            | null
          note_moyenne: number | null
          photo_depot: string | null
          raison_sociale: string | null
          rayon_max_km: number | null
          slug: string | null
          vehicules: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_localite_id_fkey"
            columns: ["localite_id"]
            isOneToOne: false
            referencedRelation: "localites"
            referencedColumns: ["id"]
          },
        ]
      }
      types_vitrine: {
        Row: {
          description: string | null
          famille_nom: string | null
          famille_slug: string | null
          formats_apercu: Json | null
          id: string | null
          nb_formats: number | null
          nb_fournisseurs: number | null
          nb_offres: number | null
          nom: string | null
          nom_mg: string | null
          ordre: number | null
          photo: string | null
          prix_des: number | null
          slug: string | null
          unite: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accepter_demande_materiau: {
        Args: {
          _categorie_id: string
          _demande_id: string
          _nom_normalise: string
          _poids_kg: number
          _slug: string
          _unite: Database["public"]["Enums"]["unite"]
          _volume_m3: number
        }
        Returns: string
      }
      annuaire_fournisseurs: {
        Args: {
          _famille?: string
          _lat?: number
          _livre_chez_moi?: boolean
          _lng?: number
          _nature?: string
          _tri?: string
          _type?: string
          _verifies_seulement?: boolean
        }
        Returns: {
          distance_km: number
          familles: string[]
          id: string
          localite_nom: string
          logo_url: string
          metier: string
          nature: string
          nb_avis: number
          nb_produits: number
          niveau_verification: string
          note_moyenne: number
          photo_depot: string
          produit_phare: Json
          raison_sociale: string
          rayon_max_km: number
          slug: string
          types: string[]
        }[]
      }
      appeler_fonction_akora: { Args: { _nom: string }; Returns: number }
      arbitrer_litige: {
        Args: {
          _decision: string
          _litige_id: string
          _montant_rembourse?: number
        }
        Returns: undefined
      }
      attribuer_badges_partenaire: { Args: never; Returns: number }
      compter_abonnes: { Args: { _fournisseur_id: string }; Returns: number }
      compter_vue_produit: { Args: { _produit_id: string }; Returns: undefined }
      confirmer_email_oauth: { Args: never; Returns: boolean }
      confirmer_livraison: {
        Args: { _commande_id: string }
        Returns: undefined
      }
      confirmer_paiement_manuel: {
        Args: { _accepte: boolean; _motif?: string; _paiement_id: string }
        Returns: Database["public"]["Enums"]["statut_paiement"]
      }
      consommer_code_reinitialisation: {
        Args: { _code: string; _email: string }
        Returns: string
      }
      consommer_quota: {
        Args: { _cle: string; _plafond: number; _sujet: string }
        Returns: boolean
      }
      controle_ledger: {
        Args: never
        Returns: {
          ecart: number
          fournisseur_id: string
          solde_ledger: number
          solde_portefeuille: number
        }[]
      }
      creer_code_reinitialisation: { Args: { _email: string }; Returns: Json }
      creer_code_verification: {
        Args: { _email: string; _usage?: string; _user_id: string }
        Returns: string
      }
      creer_demande: {
        Args: {
          _date_souhaitee?: string
          _lat?: number
          _libelle_lieu?: string
          _lignes: Json
          _lng?: number
          _localite_id?: string
          _note?: string
        }
        Returns: string
      }
      demandes_pour_mon_depot: {
        Args: never
        Returns: {
          created_at: string
          date_souhaitee: string
          deja_propose: boolean
          distance_km: number
          expire_le: string
          id: string
          libelle_lieu: string
          lignes: Json
          localite_nom: string
          nb_correspondances: number
          note: string
          statut_proposition: string
        }[]
      }
      devenir_fournisseur: { Args: never; Returns: undefined }
      ecrire_ledger: {
        Args: {
          _commande_id?: string
          _fournisseur_id: string
          _libelle: string
          _montant: number
          _paiement_id?: string
          _retrait_id?: string
          _type: Database["public"]["Enums"]["type_ecriture"]
        }
        Returns: number
      }
      enregistrer_reference_paiement: {
        Args: { _paiement_id: string; _reference: string }
        Returns: undefined
      }
      est_appel_systeme: { Args: never; Returns: boolean }
      est_membre_fournisseur: {
        Args: { _fournisseur_id: string }
        Returns: boolean
      }
      executer_retrait: {
        Args: { _reference: string; _retrait_id: string }
        Returns: undefined
      }
      fermer_demande: { Args: { _demande_id: string }; Returns: undefined }
      fiche_reservee: { Args: { _jeton: string }; Returns: Json }
      generer_code_otp: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      journaliser: {
        Args: {
          _action: string
          _apres?: Json
          _avant?: Json
          _entite: string
          _entite_id: string
        }
        Returns: undefined
      }
      liberer_sequestre: { Args: { _paiement_id: string }; Returns: number }
      ma_demande: { Args: never; Returns: Json }
      moderer_avis: {
        Args: {
          _avis_id: string
          _statut: Database["public"]["Enums"]["statut_moderation"]
        }
        Returns: undefined
      }
      mon_fournisseur_id: { Args: never; Returns: string }
      notifier: {
        Args: {
          _categorie?: string
          _corps?: string
          _lien?: string
          _titre: string
          _user_id: string
        }
        Returns: undefined
      }
      observatoire_prix: {
        Args: { _famille?: string; _localite_slug?: string }
        Returns: {
          dernier_releve: string
          famille_slug: string
          fiable: boolean
          materiau_nom: string
          materiau_ref_id: string
          materiau_slug: string
          nb_depots: number
          nb_sources: number
          prix_max: number
          prix_median: number
          prix_min: number
          unite: string
        }[]
      }
      offres_pour_materiaux: {
        Args: { _lat?: number; _lng?: number; _slugs: string[] }
        Returns: {
          coef_sinuosite: number
          distance_km: number
          fournisseur_id: string
          fournisseur_lat: number
          fournisseur_lng: number
          fournisseur_niveau: string
          fournisseur_nom: string
          fournisseur_slug: string
          materiau_nom: string
          materiau_slug: string
          poids_kg_unite: number
          prix_unitaire: number
          produit_id: string
          produit_nom: string
          produit_slug: string
          quantite_min: number
          rayon_max_km: number
          stock_statut: string
          unite: string
          volume_m3_unite: number
        }[]
      }
      prochain_numero_commande: { Args: never; Returns: string }
      proposer: {
        Args: {
          _delai_jours?: number
          _demande_id: string
          _lignes: Json
          _livraison?: number
          _message?: string
        }
        Returns: string
      }
      purger_codes_expires: { Args: never; Returns: number }
      recalculer_niveau_verification: {
        Args: { _fournisseur_id: string }
        Returns: Database["public"]["Enums"]["niveau_verification"]
      }
      rechercher_referentiel: {
        Args: { limite?: number; portee?: string; requete: string }
        Returns: {
          famille_nom: string
          famille_slug: string
          format_slug: string
          id: string
          kind: string
          nb_formats: number
          nb_offres: number
          nom: string
          prix_des: number
          rang: number
          type_nom: string
          type_slug: string
        }[]
      }
      refuser_demande_materiau: {
        Args: { _demande_id: string; _motif: string }
        Returns: undefined
      }
      refuser_fiche: {
        Args: { _jeton: string; _motif?: string }
        Returns: boolean
      }
      refuser_retrait: {
        Args: { _motif: string; _retrait_id: string }
        Returns: undefined
      }
      repondre_proposition: {
        Args: { _decision: string; _proposition_id: string }
        Returns: undefined
      }
      reveler_contact_fournisseur: {
        Args: { _fournisseur_id: string }
        Returns: {
          telephone: string
          whatsapp: string
        }[]
      }
      revendiquer_fiche: { Args: { _jeton: string }; Returns: string }
      revoquer_sessions: { Args: { _user_id: string }; Returns: boolean }
      sans_accent: { Args: { texte: string }; Returns: string }
      statuer_document: {
        Args: {
          _document_id: string
          _motif?: string
          _statut: Database["public"]["Enums"]["statut_document"]
        }
        Returns: Database["public"]["Enums"]["niveau_verification"]
      }
      taux_commission: { Args: { _categorie_id: string }; Returns: number }
      transition_commande_valide: {
        Args: {
          _depuis: Database["public"]["Enums"]["statut_commande"]
          _vers: Database["public"]["Enums"]["statut_commande"]
        }
        Returns: boolean
      }
      transition_paiement_valide: {
        Args: {
          _depuis: Database["public"]["Enums"]["statut_paiement"]
          _vers: Database["public"]["Enums"]["statut_paiement"]
        }
        Returns: boolean
      }
      verifier_code_email: {
        Args: { _code: string; _email: string; _usage?: string }
        Returns: boolean
      }
      verifier_solde_ledger: {
        Args: never
        Returns: {
          ecart: number
          fournisseur_id: string
          solde_ledger: number
          solde_portefeuille: number
        }[]
      }
    }
    Enums: {
      app_role: "acheteur" | "fournisseur" | "admin"
      mode_paiement: "en_ligne_integral" | "en_ligne_acompte" | "a_la_livraison"
      niveau_verification: "non_verifie" | "en_cours" | "verifie" | "partenaire"
      operateur_paiement: "mvola" | "orange_money" | "airtel_money"
      role_interne: "proprietaire" | "gestionnaire" | "commercial"
      statut_commande:
        | "brouillon"
        | "envoyee"
        | "vue"
        | "devis_envoye"
        | "acceptee"
        | "en_attente_paiement"
        | "payee"
        | "en_preparation"
        | "en_livraison"
        | "livree"
        | "cloturee"
        | "annulee"
        | "refusee"
        | "litige"
      statut_demande_materiau: "en_attente" | "acceptee" | "refusee"
      statut_document: "en_attente" | "valide" | "refuse"
      statut_fournisseur: "brouillon" | "en_attente" | "actif" | "suspendu"
      statut_litige: "ouvert" | "en_examen" | "tranche"
      statut_moderation: "en_attente" | "publie" | "masque"
      statut_paiement:
        | "initie"
        | "en_attente_client"
        | "en_verification"
        | "confirme"
        | "sequestre"
        | "libere"
        | "rembourse"
        | "rejete"
        | "expire"
        | "echoue"
      statut_produit: "brouillon" | "en_attente_materiau" | "actif" | "inactif"
      statut_publication: "publiee" | "masquee" | "signalee" | "supprimee"
      statut_retrait: "demande" | "en_cours" | "paye" | "refuse"
      stock_statut: "en_stock" | "sur_commande" | "rupture"
      type_client: "particulier" | "entreprise"
      type_document:
        | "nif"
        | "stat"
        | "rcs"
        | "cin_gerant"
        | "photo_depot"
        | "photo_camion"
        | "numero_versement"
      type_ecriture:
        | "credit_sequestre"
        | "liberation"
        | "commission"
        | "retrait"
        | "remboursement"
        | "ajustement"
      type_localite: "region" | "district" | "commune" | "quartier"
      type_publication:
        | "stock"
        | "baisse_prix"
        | "livraison"
        | "prix_marche"
        | "demande"
      unite:
        | "piece"
        | "sac"
        | "m3"
        | "tonne"
        | "m2"
        | "ml"
        | "botte"
        | "chargement"
        | "palette"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["acheteur", "fournisseur", "admin"],
      mode_paiement: [
        "en_ligne_integral",
        "en_ligne_acompte",
        "a_la_livraison",
      ],
      niveau_verification: ["non_verifie", "en_cours", "verifie", "partenaire"],
      operateur_paiement: ["mvola", "orange_money", "airtel_money"],
      role_interne: ["proprietaire", "gestionnaire", "commercial"],
      statut_commande: [
        "brouillon",
        "envoyee",
        "vue",
        "devis_envoye",
        "acceptee",
        "en_attente_paiement",
        "payee",
        "en_preparation",
        "en_livraison",
        "livree",
        "cloturee",
        "annulee",
        "refusee",
        "litige",
      ],
      statut_demande_materiau: ["en_attente", "acceptee", "refusee"],
      statut_document: ["en_attente", "valide", "refuse"],
      statut_fournisseur: ["brouillon", "en_attente", "actif", "suspendu"],
      statut_litige: ["ouvert", "en_examen", "tranche"],
      statut_moderation: ["en_attente", "publie", "masque"],
      statut_paiement: [
        "initie",
        "en_attente_client",
        "en_verification",
        "confirme",
        "sequestre",
        "libere",
        "rembourse",
        "rejete",
        "expire",
        "echoue",
      ],
      statut_produit: ["brouillon", "en_attente_materiau", "actif", "inactif"],
      statut_publication: ["publiee", "masquee", "signalee", "supprimee"],
      statut_retrait: ["demande", "en_cours", "paye", "refuse"],
      stock_statut: ["en_stock", "sur_commande", "rupture"],
      type_client: ["particulier", "entreprise"],
      type_document: [
        "nif",
        "stat",
        "rcs",
        "cin_gerant",
        "photo_depot",
        "photo_camion",
        "numero_versement",
      ],
      type_ecriture: [
        "credit_sequestre",
        "liberation",
        "commission",
        "retrait",
        "remboursement",
        "ajustement",
      ],
      type_localite: ["region", "district", "commune", "quartier"],
      type_publication: [
        "stock",
        "baisse_prix",
        "livraison",
        "prix_marche",
        "demande",
      ],
      unite: [
        "piece",
        "sac",
        "m3",
        "tonne",
        "m2",
        "ml",
        "botte",
        "chargement",
        "palette",
      ],
    },
  },
} as const
