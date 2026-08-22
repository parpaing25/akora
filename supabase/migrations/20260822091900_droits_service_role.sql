-- ═══════════════════════════════════════════════════════════════════════════
-- AKORA — 20. Droits d'execution du role de service
-- ═══════════════════════════════════════════════════════════════════════════
-- La migration 11 a revoque EXECUTE « from public » sur les fonctions
-- internes. C'etait le bon geste — mais `public` inclut `service_role`, donc
-- les Edge Functions se retrouvaient elles aussi a la porte.
--
-- On rouvre ici, et UNIQUEMENT pour `service_role` : le role que seul le
-- serveur possede, jamais le navigateur. C'est la difference entre « personne
-- ne peut ecrire dans le ledger » et « seul le serveur le peut ».

grant execute on function public.ecrire_ledger(uuid, public.type_ecriture, bigint, text, uuid, uuid, uuid) to service_role;
grant execute on function public.liberer_sequestre(uuid) to service_role;
grant execute on function public.journaliser(text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.notifier(uuid, text, text, text, text) to service_role;
grant execute on function public.consommer_quota(text, text, integer) to service_role;
grant execute on function public.prochain_numero_commande() to service_role;
grant execute on function public.recalculer_niveau_verification(uuid) to service_role;
grant execute on function public.attribuer_badges_partenaire() to service_role;
grant execute on function public.verifier_solde_ledger() to service_role;
grant execute on function public.taux_commission(uuid) to service_role;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

-- Les tables d'argent : le service ecrit, personne d'autre.
grant insert, update on public.paiements to service_role;
grant insert, update on public.commandes to service_role;
grant insert on public.lignes_commande to service_role;
grant insert, update on public.webhooks_recus to service_role;
grant insert, update on public.portefeuilles to service_role;
grant select, insert on public.ledger to service_role;
grant insert on public.notifications to service_role;
grant insert, update on public.audit_log to service_role;
grant select, insert, update on public.rate_limits to service_role;
grant select, insert, update on public.compteurs_commande to service_role;

comment on function public.ecrire_ledger is
  'Seule fonction autorisee a bouger un solde, et seul `service_role` peut l''appeler. Toute mise a jour de portefeuille sans ecriture correspondante est un bug.';
