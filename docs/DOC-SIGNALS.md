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

## 2026-08-04 — sessie Max — ARCHITECTURE.md

**Wat:** Nieuw component: het **Financieel-rapport** (afdracht per vereniging × cyclus). Nieuw bestand `Financieel.gs` (pure rekenlogica) + `haalOrderRegels()` in `Woo.gs` (orderREGEL-niveau i.p.v. orderniveau) + `schrijfFinancieel()` in `Sheet.gs` + **Stap 6** in `dagelijkseRun` (de run heeft nu zes stappen, niet vijf). Rekent bewust NIET vanuit het Deelnemers-tabblad, en gebruikt een eigen seizoensgrens van 1 juni (los van `bepaalSeizoen()`'s 1 augustus). Daarnaast vier nieuwe Deelnemers-kolommen: `rol` (Speler/Keeper), `product`, `bedrag` (na `vereniging`) en `reminder_anker` (achteraan). Config-tabblad heeft een nieuwe mapping in kolommen L:M (`rollen`), en de bestaande `fases`-mapping (G:H) is nu pas functioneel in gebruik.
**Code:** `google-apps-script/deelnemers/Financieel.gs`, `Woo.gs`, `Sheet.gs`, `Dagelijks.gs`, `Deelnemers.gs`, `Config.gs`
**Commit:** `3f3f526..092f015`
**Voorgestelde plek:** ARCHITECTURE.md — nieuwe subsectie "Financieel-rapport" onder het Deelnemers-werkboek; werk de beschrijving van `dagelijkseRun` bij van vijf naar zes stappen en neem de kolomlijst van het Deelnemers-tabblad opnieuw op. Zie ADR-009 en ADR-010 in DECISIONS.md.

## 2026-08-04 — sessie Max — CONVENTIONS.md

**Wat:** Drie nieuwe, niet voor de hand liggende patronen, alle drie uit een echte productiebug deze sessie:
1. **`LockService.getScriptLock()` verplicht** rond elke functie die de Deelnemers-sheet leest-muteert-terugschrijft. Zonder lock overschreef een overlappende run (dagelijkse trigger tegelijk met een handmatige menu-actie) de net weggeschreven staat — 27 verstuurde reminders stonden wél in het Log maar niet in de sheet.
2. **Herhaald WooCommerce-verkeer binnen één run cachen** (`CacheService.getScriptCache()`). Twee losse aanroepen van de productcatalogus kort na elkaar lokten een 403 van de WAF uit; een eerdere versie met één aanroep per rij (~35 stuks) werd na de eerste al geblokkeerd. Regel: bulk ophalen + lokaal opzoeken, nooit per-rij aanroepen.
3. **Expliciete `String()`-coercion bij het teruglezen van Sheets-cellen.** Google Sheets zet een puur numerieke tekstcel (`'2526'`) zelf om naar een getalcel, waardoor elke strikte vergelijking (`===`) stil faalt. Zelfde klasse als de al bekende datum-coercion-valkuil.
**Code:** `google-apps-script/deelnemers/Dagelijks.gs`, `Menu.gs`, `Woo.gs`, `Sheet.gs`
**Commit:** `38453d2`, `515054d`, `2b71a06`, `f29873d`
**Voorgestelde plek:** CONVENTIONS.md — nieuwe sectie "Google Apps Script" met deze drie regels; de bestaande User-Agent-regel (uit de vorige sessie) hoort in dezelfde sectie thuis.

## 2026-08-04 — sessie Max — GLOSSARY.md

**Wat:** Nieuwe domeintermen rond de cyclusadministratie en afdracht: **cyclus** (C1/C2/C3, een trainingsblok; drie per seizoen), **seizoenkaart** (SMT/SZT, met of zonder tenue; geldt voor alle drie de cycli), **afdracht** (€20 per deelnemer per cyclus, excl. btw, af te dragen aan de vereniging), **rol** (Speler/Keeper, afgeleid uit de WooCommerce-categorie Voetbaltraining/Keeperstraining), **inschrijving** (`pa_inschrijving`, de WooCommerce-variatie die cyclus of seizoenkaart bepaalt — een variatie, géén categorie), **reminder_anker** (de datum waarvanaf de reminder-drempels tellen, los van de uitnodigingsdatum). Plus het onderscheid tussen de twee seizoensgrenzen: 1 juni (financieel) vs. 1 augustus (deelnemersadministratie).
**Code:** `google-apps-script/deelnemers/Financieel.gs`, `Sheet.gs`, `Config.gs`
**Commit:** `f99de10`, `4dede36`, `3d28127`, `092f015`
**Voorgestelde plek:** GLOSSARY.md — termen "cyclus", "seizoenkaart", "afdracht", "rol", "inschrijving", "reminder_anker", plus een korte notitie over de twee seizoensdefinities.

## 2026-08-04 — sessie Max (vervolg) — CONVENTIONS.md

**Wat:** Twee nieuwe regels uit de fysio-toestemmingssessie.
1. **Contentbestanden die via een Breakdance Code/HTML-blok gaan, moeten hun eigen gescopete `<style>` meenemen.** Zo'n blok rendert rauwe HTML zonder de typografie-instellingen die de builder op zijn eigen tekstelementen zet: geen kleur, geen marges, geen leesbreedte. Scope op één wrapper-klasse zodat de CSS niets buiten die pagina raakt, en zet de kleur op één plek zodat de rest hem via `inherit` oppikt.
2. **Elke waarde die als tekst in Google Sheets moet blijven staan heeft een expliciet tekstformaat (`@`) nodig bij het schrijven** — niet alleen een `String()`-coercion bij het teruglezen. De `order_ids`-bug is de derde van deze klasse (na datum- en seizoen-coercion): `join(',')` levert `"935,1147"`, wat Sheets met een Nederlandse locale als getal interpreteert. De bestaande CONVENTIONS-regel dekt alleen de leeskant.
**Code:** `plugins/grovia-fysio-toestemming/infopagina.html`, `google-apps-script/deelnemers/Sheet.gs`
**Commit:** `8edec86`, `447d27d` (regel 1); regel 2 is een bevinding, nog niet in code gefixt
**Voorgestelde plek:** CONVENTIONS.md — regel 1 in een nieuwe sectie "WordPress / Breakdance", regel 2 aanvullen op de bestaande Sheets-coercion-regel in de "Google Apps Script"-sectie.

## 2026-08-04 — sessie Max (vervolg) — GLOSSARY.md

**Wat:** Nieuwe termen rond het blessurepreventie-onderdeel: **SMC Dijk en Waard** (de fysiotherapiepraktijk die als partner de fysieke testen afneemt, Heerhugowaard), **MoveHealth** (het app-systeem waarin deelnemers hun testresultaten en een persoonlijk blessurepreventieprogramma krijgen), **toestemmingsverklaring** (het door Grovia en SMC goedgekeurde document dat vastlegt waarvoor toestemming wordt gegeven, en dat letterlijk voorschrijft met welke tekst het checkout-hokje wordt aangevinkt), en **testen en meten** (de terminologie die de klant zelf gebruikt voor wat de plugin, pop-up en URL-slug "fysieke intakes en behandelingen" noemen — een bewust niet-opgeloste terminologiemix, nu drie varianten).
**Code:** `plugins/grovia-fysio-toestemming/infopagina.html`, `grovia-fysio-toestemming.php`
**Commit:** `e1a5240`, `2e56d47`
**Voorgestelde plek:** GLOSSARY.md — vier termen, plus een notitie bij de terminologiemix dat er drie varianten naast elkaar bestaan en waarom.
