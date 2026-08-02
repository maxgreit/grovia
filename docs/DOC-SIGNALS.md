# Doc-drift signals — buffer voor /dag-afsluiting

Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

---

## 2026-06-23 — sessie Max — ARCHITECTURE.md

**Wat:** Nieuwe component/pijler: Action Type test. Google Apps Script genereert per vereniging een Google Form + gekoppelde Sheet; scoring via ARRAYFORMULA in apart "Resultaten"-tabblad. Plus uitnodigingsmails (email-templates/).
**Code:** `google-apps-script/action-type-setup.gs`, `email-templates/*.html`, `docs/ACTION-TYPE-TEST.md`
**Commit:** (working copy, nog niet gecommit)
**Voorgestelde plek:** ARCHITECTURE.md — nieuwe sectie "Action Type test" naast de assessment-/WhatsApp-componenten; noem Forms→Sheets→ARRAYFORMULA-flow en de Forms-overschrijf-gotcha.

## 2026-06-23 — sessie Max — GLOSSARY.md

**Wat:** Nieuwe domeintermen: "Action Type" (MBTI-stijl 4-letter type, bv. ISTJ), de 4 dichotomieën (E/I, S/N, T/F, J/P), "Action Type test".
**Code:** `docs/ACTION-TYPE-TEST.md`, `test_docs/`
**Commit:** (working copy, nog niet gecommit)
**Voorgestelde plek:** GLOSSARY.md — term "Action Type" + korte uitleg scoring.

## 2026-07-28 — sessie Max — GLOSSARY.md

**Wat:** Nieuwe domeintermen: "fysio-toestemming" (optionele checkout-toestemming voor fysieke intakes/behandelingen + declaratie zorgverzekeraar), categorie "toestemming-vereist" (opt-in trigger), "potentieprofiel" (uit klant-poptekst), onderscheid meta afwezig = n.v.t. vs "nee" = bewust geweigerd.
**Code:** `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php`, `docs/superpowers/specs/2026-07-27-fysio-toestemming-design.md`
**Commit:** `8ded5d5..99867d0`
**Voorgestelde plek:** GLOSSARY.md — termen "fysio-toestemming", "toestemming-vereist (categorie)", "potentieprofiel".

## 2026-08-02 — sessie Max — ARCHITECTURE.md

**Wat:** Nieuwe dataflow voor Ixly-voltooiingscontrole: `ixly-aanmelding` bewaart assignment-uuid's als WooCommerce order-meta (`_grovia_ixly_taken`); `ixly-status` en `grovia-herinnering` lezen die terug via `GET /assignments/{uuid}` in plaats van het nooit-werkende lijst-endpoint. Nieuwe env vars `GROVIA_WORDPRESS_URL`/`GROVIA_WOO_CONSUMER_KEY`/`GROVIA_WOO_CONSUMER_SECRET`. ARCHITECTURE.md kent deze flow nog niet (was al vóór deze sessie verouderd — kent `ixly-status`/`grovia-herinnering`/het Deelnemers-werkboek helemaal niet).
**Code:** `ixly-aanmelding/__init__.py`, `ixly-status/__init__.py`, `grovia-herinnering/__init__.py`, `grovia_shared/ixly_api.py`, `google-apps-script/deelnemers/*.gs`
**Commit:** `3286406..2833d43`
**Voorgestelde plek:** ARCHITECTURE.md — nieuwe sectie voor het Deelnemers-werkboek + de drie Azure Functions eromheen (`ixly-aanmelding`, `ixly-status`, `grovia-herinnering`), inclusief de order-meta-brug tussen WooCommerce en de Google Sheet. Zie ADR-008 in DECISIONS.md voor de volledige beslissing.

## 2026-08-02 — sessie Max — README.md

**Wat:** Drie nieuwe verplichte env vars voor `ixly-aanmelding`: `GROVIA_WORDPRESS_URL`, `GROVIA_WOO_CONSUMER_KEY`, `GROVIA_WOO_CONSUMER_SECRET` (een aparte, schrijfbare WooCommerce REST-sleutel, los van de bestaande alleen-lezen sleutel van Apps Script).
**Code:** `local.settings.json.example`, `.github/workflows/deploy.yml`
**Commit:** `160b91e`, `42646ac`
**Voorgestelde plek:** README.md (of setup-sectie) — lijst met vereiste env vars/secrets bijwerken met deze drie, inclusief de opmerking dat de WooCommerce-sleutel schrijfrechten nodig heeft (niet alleen-lezen).

## 2026-08-02 — sessie Max — CONVENTIONS.md

**Wat:** Nieuw, niet voor de hand liggend patroon ontdekt: Python's `requests`-library moet een expliciete, eigen `User-Agent`-header meesturen bij aanroepen naar grovia.nl's WooCommerce REST API — de standaard `python-requests/x.x.x`-User-Agent wordt door een server-side WAF-regel geblokkeerd (403 "Request forbidden by administrative rules"), bevestigd door dezelfde aanroep vanaf hetzelfde IP te testen met alleen een andere User-Agent.
**Code:** `ixly-aanmelding/__init__.py` (`_bewaar_ixly_taken`)
**Commit:** `42646ac`
**Voorgestelde plek:** CONVENTIONS.md — regel: "elke nieuwe `requests`-aanroep naar grovia.nl (WooCommerce REST API) moet een eigen `User-Agent`-header zetten, nooit de requests-default gebruiken."

## 2026-08-02 — sessie Max (vervolg) — README.md

**Wat:** De vier `ACTION_TYPE_ENTRY_CODE_KA`/`ACTION_TYPE_ENTRY_NAAM_KA`/`ACTION_TYPE_ENTRY_CODE_SU`/`ACTION_TYPE_ENTRY_NAAM_SU`-env vars bestonden al in `local.settings.json.example` en werden al door de code gebruikt, maar stonden nooit in `.github/workflows/deploy.yml` — een GitHub Secret zetten had dus geen enkel effect, root cause van élke Action Type-inzending die in "Handmatig koppelen" belandde. Nu toegevoegd aan de deploy-workflow en geverifieerd in Azure.
**Code:** `.github/workflows/deploy.yml`
**Commit:** `987024d`
**Voorgestelde plek:** README.md — vereiste-env-vars-lijst bijwerken met deze vier, plus de opmerking dat een GitHub Secret zonder de bijbehorende regel in `deploy.yml` stil genegeerd wordt.
