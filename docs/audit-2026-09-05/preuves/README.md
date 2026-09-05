# Preuves de l'audit du 05/09/2026

| Fichier | Contenu |
|---|---|
| `crawl_akora.py` → `crawl_akora.json` | 36 routes × (390 px, 1280 px) : titre, canonique, robots, h1, débordement, cibles < 44 px, JSON-LD, requêtes, échecs, FCP/TTFB/CLS |
| `axe_akora.py` → `axe_akora.json` | axe-core 4 dans Chromium réel, 10 pages à 390 px (agent mobile, `bypass_csp`) |
| `anomalies_akora.py`, `anomalies2_akora.py` | Rejeu ciblé : corps des HTTP 400 (`vehicules_livraison`), débordement dans le temps, console |
| `generer_cartographie.py` | Génère `../01-cartographie-routes.md` depuis `crawl_akora.json` |
| `lh-*.json.gz` | Lighthouse 12.8.2, mobile simulé, accueil / fiche produit / page format (`gunzip` pour lire) |
| `capture-390*.jpeg` | Captures à 390×844 (qualité 60) des pages principales |

Relancer : `pip install playwright && playwright install chromium`, puis `python crawl_akora.py` depuis ce dossier (les scripts écrivent à côté d'eux). Lighthouse : `CHROME_PATH=<chrome de Playwright>/chrome-win64/chrome.exe npx lighthouse@12 <url> --form-factor=mobile --screenEmulation.mobile --output=json`.

⚠ Toujours un agent utilisateur réaliste : Chromium headless nu reçoit d'o2switch une page de blocage 429 (constat O-02) et les mesures portent alors sur cette page.
