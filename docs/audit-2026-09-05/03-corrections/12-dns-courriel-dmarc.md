# Correctif X-05 / C-01 — courriel : DMARC en observation seule, boîte de contact non vérifiée (P2, P1)

## Relevé DNS du 05/09/2026 (`nslookup … 8.8.8.8`)

| Enregistrement | Valeur | Lecture |
|---|---|---|
| `fonenako.mg TXT` | `v=spf1 ip4:109.234.166.169 +a +mx +include:spf.jabatus.fr ~all` | SPF présent (o2switch) |
| `akora.fonenako.mg TXT` | `v=spf1 +a +mx +ip4:109.234.166.169 ~all` | SPF présent pour le sous-domaine |
| `_dmarc.fonenako.mg TXT` | **`v=DMARC1; p=none;`** | Observation seule, **sans adresse de rapport** : personne ne lit rien, un usurpateur passe |
| `_dmarc.akora.fonenako.mg` | absent (hérite de `p=none`) | idem |
| `fonenako.mg MX` | `mail.fonenako.mg` (préf. 0) | OK |
| `akora.fonenako.mg MX` | **absent** | Le courrier vers `@akora.fonenako.mg` tombe sur l'enregistrement A (le serveur o2switch) : ça marche **seulement si** le sous-domaine est déclaré comme domaine de messagerie dans cPanel |
| `*._domainkey.fonenako.mg` | voir relevé DKIM ci-dessous | |

**Boîte `contact@akora.fonenako.mg`** — seul canal de contact du site (`Contact.tsx:32`, `MentionsLegales.tsx:10`, `Confidentialite.tsx`) : **NON VÉRIFIÉ — à tester manuellement** : depuis un Gmail, envoyer « test audit » à cette adresse, puis vérifier dans cPanel o2switch › Comptes de messagerie (ou le webmail) qu'il arrive. La sonde SMTP depuis ce PC a échoué (port 25 sortant bloqué : `TimeoutError`), rien ne prouve que la boîte existe.

**Effort** : 30 min DNS + 15 min test.

---

## 1. DMARC — passer en `quarantine` avec rapports

Chez o2switch (Zone DNS) sur `fonenako.mg`, remplacer l'enregistrement `_dmarc` :

```
_dmarc.fonenako.mg.  TXT  "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@fonenako.mg; ruf=mailto:dmarc@fonenako.mg; fo=1; adkim=r; aspf=r"
```

Conditions avant de basculer (sinon les vrais courriels de Fonenako partent en spam) :
1. **DKIM** actif sur `mail.fonenako.mg` : cPanel › Authentification e-mail › DKIM « activé », et l'enregistrement `default._domainkey.fonenako.mg` publié (voir relevé). S'il manque → l'activer d'abord, attendre 24 h.
2. Créer la boîte `dmarc@fonenako.mg` (ou un alias vers le Gmail Fonenako) pour recevoir les rapports agrégés.
3. Passer d'abord une semaine en `p=none; rua=…` pour lire les rapports, **puis** `p=quarantine`. Étape J-7 → J+7 de la checklist.

## 2. Si les Edge Functions envoient via Brevo (recommandé dans `11-auth-smtp-configuration.md`)

Ajouter à `akora.fonenako.mg` (ou au domaine expéditeur choisi) :
```
akora.fonenako.mg.            TXT   "v=spf1 +a +mx +ip4:109.234.166.169 include:spf.brevo.com ~all"
mail._domainkey.akora.fonenako.mg.  TXT   "<clé DKIM fournie par Brevo › Expéditeurs & IP › Domaines>"
```
et vérifier le domaine dans Brevo (bouton « Authentifier »). Sans cette étape, Gmail classe les codes de connexion en spam : l'inscription paraît « ne rien envoyer ».

## 3. Adresse de contact — décision

| Option | Avantage | Inconvénient |
|---|---|---|
| **A. Créer `contact@akora.fonenako.mg` dans cPanel + MX explicite** `akora.fonenako.mg. MX 0 mail.fonenako.mg.` | Cohérent avec ce qui est déjà imprimé sur 4 pages | Une boîte de plus à relever |
| B. Rediriger vers `contact.fonenako@gmail.com` (alias cPanel) | Une seule boîte à lire (Andry lit déjà ce Gmail) | Réponses envoyées depuis Gmail : SPF/DKIM de Google, pas d'Akora — acceptable |

L'option **A + redirection vers le Gmail** cumule les deux. Dans tous les cas : **un numéro de téléphone/WhatsApp** doit rejoindre l'adresse (Q5, page Contact reconstruite dans `04-pages-construites/`).

## 4. Vérification

```bash
nslookup -type=TXT _dmarc.fonenako.mg 8.8.8.8            # p=quarantine, rua présent
nslookup -type=TXT default._domainkey.fonenako.mg 8.8.8.8 # v=DKIM1
nslookup -type=MX akora.fonenako.mg 8.8.8.8               # mail.fonenako.mg
```
Puis https://mxtoolbox.com/SuperTool.aspx?action=dmarc%3afonenako.mg et un envoi test vers https://www.mail-tester.com (score ≥ 8/10).
