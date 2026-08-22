// Fichier GÉNÉRÉ par `npm run types:gen`. Ne pas modifier à la main.
//
// Contenu provisoire : le projet Supabase d'Akora n'est pas encore branché.
// Dès que ~/.akora-secrets/supabase.txt est en place, `npm run db:push` puis
// `npm run types:gen` remplacent intégralement ce fichier par le schéma réel.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json>; Relationships: [] }>;
    Views: Record<string, { Row: Record<string, Json>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, Json>; Returns: Json }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
