# Architectuur — Grovia Automations

## Overzicht

_Nog in te vullen — beschrijf hier de globale architectuur en hoe de onderdelen samenhangen._

## Onderdelen

### 1. E-mailautomatisering (WordPress / FunnelKit)

De automatisering bestaat uit twee PHP-plugins die als keten samenwerken:

**Plugin:** [`plugins/grovia-automations/`](../plugins/grovia-automations/)

#### Keten

```
Aankoop (WooCommerce)
  → grovia_generate_ixly_tag        (grovia-automations.php)
      Maakt tag aan: [School][Fase][Seizoen] bijv. SUC12627
      Wijst tag toe aan FunnelKit-contact

  → grovia_assessment_router        (grovia-assessment-router.php)
      Triggered op: Tag Added
      Checkt of contact al assessment heeft dit seizoen
      Kiest uitkomst:
        C1 / SMT / SZT → tag StuurAssessment
        C2 / C3        → tag StuurBetaallinkAssessment

  → Workflow 3: tag StuurAssessment
      Azure Function aanroepen → kandidaat + assignment aanmaken bij Ixly
      E-mail met login_url (directe assessmentlink)

  → Workflow 3: tag StuurBetaallinkAssessment
      E-mail met betaallink voor instapkosten (C2/C3 missen cyclus 1)
      Na betaling → tag StuurAssessment → zelfde pad als hierboven
```

#### Tagformaat

`[Schoolcode][Fasecode][Seizoencode]` — bijv. `SUC12627`

| Onderdeel | Omschrijving | Voorbeeld |
|---|---|---|
| Schoolcode | 2 letters, op basis van productcategorie-slug | `SU` (Schagen United) |
| Fasecode | 2–3 letters, op basis van `pa_inschrijving` attribuut | `C1`, `C2`, `SMT` |
| Seizoencode | 4 cijfers: laatste 2 van start- + eindjaar | `2627` (2026–2027) |

#### Secrets

`GROVIA_FUNNELKIT_API_KEY` staat **niet** in de plugin-code maar in `wp-config.php`. Zie ADR-001.

### 2. Assessment aanmeldingen (Azure Functions)

**App naam:** `grovia-automations`
**Base URL:** `https://grovia-automations-a9dxfzhpg3bbg8cr.westeurope-01.azurewebsites.net`

| Endpoint | Auth | Trigger | Functie |
|---|---|---|---|
| `/api/ixly-aanmelding` | `function` | FunnelKit tag `StuurAssessment` | Candidate upsert + assignments aanmaken bij Ixly, assignment-uuid's bewaren als order-meta, e-mail versturen |
| `/api/ixly-status` | `function` | Apps Script (dagelijkse run, stap 3) | Per order de voltooiingsstatus van de Ixly-taken ophalen |
| `/api/ixly-scores` | `function` | Apps Script (dagelijkse run, stap 8) | Per deelnemer de genormeerde Blocks- en Rally-scores ophalen |
| `/api/grovia-herinnering` | `function` | Apps Script (dagelijkse run stap 4 + handmatige knop) | Remindermail versturen; bepaalt zelf niet wie een reminder verdient |
| `/api/mollie-betaallink` | `function` | FunnelKit tag `StuurBetaallinkAssessment` | Mollie betaallink aanmaken + e-mail naar klant |
| `/api/mollie-webhook` | `anonymous` | Mollie (betaalstatus) | Betaling verwerken; bewust anoniem, want Mollie kan geen functiesleutel meesturen |
| `/api/whatsapp-uitnodiging` | `function` | FunnelKit tag `WA_{school}_{type}` | WhatsApp groepsuitnodiging versturen via Meta Cloud API |

**Verwachte payload per endpoint (JSON POST):**

`/api/ixly-aanmelding` — alle zes velden zijn verplicht (`ixly-aanmelding/__init__.py`), `school_code` is optioneel:
```json
{
  "voornaam":    "{{contact_first_name}}",
  "achternaam":  "{{contact_last_name}}",
  "email":       "{{contact_email}}",
  "wc_klant_id": "{{wc_customer_id}}",
  "naam_kind":   "Freddie Rood",
  "order_id":    "935",
  "school_code": "KA"
}
```

`naam_kind` en `order_id` dragen de functionele betekenis: het kind wordt de Ixly-candidate en `order_id` is de `api_identifier`. Zie ADR-004. `school_code` bepaalt welke mail eruit gaat: `KA`/`SU` krijgen de combinatiemail, `MM` of een ontbrekende/onbekende code krijgt alleen de games-mail.

`/api/ixly-status` — maximaal 100 orders per aanroep:
```json
{
  "orders": [
    {
      "order_id": "935",
      "taken": [{ "naam": "Blocks Game", "assignment_uuid": "…" }]
    }
  ]
}
```
Respons: `{"resultaten": {"935": {"af": true, "completed_at": "…", "taken": [...]}}}`. Eén stukke order blokkeert de rest niet — die krijgt een `fout`-veld in zijn eigen resultaat.

`/api/ixly-scores` — assignment-uuid's in, genormeerde scores uit; maximaal 100 deelnemers per aanroep:
```json
{
  "deelnemers": [
    {
      "order_id": "1345",
      "taken": [
        { "naam": "Blocks Game", "assignment_uuid": "…" },
        { "naam": "Rally Game",  "assignment_uuid": "…" }
      ]
    }
  ]
}
```
Respons: `{"resultaten": {"1345": {"blocks": {"planning": 4.04, "flexibility": 5.89}, "rally": {"performance": 3.59, ...}, "levels_voltooid": 18, "levels_perfect": 9}}}`. Geeft alleen `latent` door (1-10-schaal); `raw` en `default_z` blijven achter. De sleutels blijven die van Ixly zelf — het vertalen naar Nederlandse kolomnamen gebeurt op één plek, in `Scores.gs` (zie hieronder), zodat de function niets van de sheetstructuur hoeft te weten. Ixly's respons is cumulatief per kandidaat, niet per taak, dus de function voegt de `normed`-dicts van alle taken samen. Eén stukke deelnemer blokkeert de rest niet.

`/api/grovia-herinnering` — `email`, `voornaam`, `naam_kind`, `school_code`, `code` en `open_testen` zijn verplicht:
```json
{
  "email": "…", "voornaam": "…", "naam_kind": "…",
  "school_code": "KA", "code": "935",
  "open_testen": ["action_type", "ixly"],
  "taken": [{ "naam": "…", "assignment_uuid": "…" }]
}
```

`/api/mollie-betaallink`:
```json
{
  "voornaam":    "{{contact_first_name}}",
  "achternaam":  "{{contact_last_name}}",
  "email":       "{{contact_email}}",
  "wc_klant_id": "{{wc_customer_id}}",
  "bedrag":      "75.00"
}
```

`/api/whatsapp-uitnodiging`:
```json
{
  "voornaam":   "{{contact_first_name}}",
  "telefoon":   "{{contact_phone}}",
  "schoolnaam": "Kolping Academie",
  "groepslink": "https://chat.whatsapp.com/..."
}
```

#### WhatsApp WABA

| Gegeven | Waarde |
|---|---|
| WABA ID | 1320633513537881 |
| Phone Number ID | 1192313800624887 (+31 6 53870629) |
| Template naam | `groviagroepsappuitnodiging` |
| Taalcode | `nl` |

Template-parameters: `{{1}}` voornaam, `{{2}}` schoolnaam, `{{3}}` groepslink.

### 3. Data warehouse (Azure SQL + PowerBI)

_Beschrijf hier de datastroom: WooCommerce API → Azure SQL → PowerBI._

### 4. Fysio-toestemming (WordPress plugin)

**Plugin:** [`plugins/grovia-fysio-toestemming/`](../plugins/grovia-fysio-toestemming/) (v1.1.0)

Optioneel toestemmingsvinkje op de checkout voor de fysieke testen door SMC Dijk en Waard + declaratie via de basisverzekering fysiotherapie. Verschijnt alleen bij producten met categorie `toestemming-vereist` (opt-in). Slaat keuze op als order-meta `_grovia_fysio_toestemming` (`ja`/`nee`, afwezig = n.v.t.) + tijdstip; zichtbaar in admin-orderscherm. Eénmalige pop-up-nudge (sessionStorage) bij afrekenen zonder vinkje.

De infopagina `/toestemming-fysieke-intakes/` is een **handmatig beheerde WordPress-pagina**; de inhoud staat als kale body-HTML in [`infopagina.html`](../plugins/grovia-fysio-toestemming/infopagina.html) en wordt in de Breakdance-editor geplakt. De vinkje-tekst is letterlijk voorgeschreven door de toestemmingsverklaring — wijzigt die tekst, dan moeten de verklaring én `infopagina.html` mee. Zie ADR-011.

Deze plugins hebben **geen deploy-pipeline**: uploaden naar WordPress gaat handmatig, anders dan de Azure Functions.

### 5. Deelnemersadministratie (Google Sheets + Apps Script)

**Werkboek:** "Grovia Deelnemers" · **Code:** [`google-apps-script/deelnemers/`](../google-apps-script/deelnemers/) · **GCP-project:** `grovia-504418`

Dit is de orkestratielaag: de sheet is de administratie, het Apps Script trekt de data bij elkaar en roept de Azure Functions aan. Een dagelijkse trigger draait om 07:00.

#### Tabbladen

| Tabblad | Rol |
|---|---|
| `Deelnemers` | Eén rij per kind per seizoen. Bron van waarheid voor de administratie. |
| `Config` | Instellingen + mappings: `scholen`, `fases` (G:H), `uitgesloten`, `rollen` (L:M) |
| `Dashboard` | Afgeleide statistieken (doorlooptijden, aantallen open) |
| `Financieel` | Afdracht per vereniging × cyclus — zie hieronder |
| `Log` | Eén regel per verstuurde mail of fout, per regel los aangevuld |
| `Controleren` | Orders die geen deelnemersrij konden worden |
| `Handmatig koppelen` | Action Type-inzendingen die niet aan een kind matchten |
| `Ixly Scores` | Genormeerde Blocks-/Rally-scores per kind, bron van waarheid voor de teamindeling — zie hieronder |

#### `dagelijkseRun` — acht stappen

1. **Ingest** — WooCommerce-orders ophalen sinds `_sindsDatum` en upserten in `Deelnemers`
2. **Action Type-afronding** — inzendingen uit de twee antwoordsheets koppelen
3. **Ixly-afronding** — via `/api/ixly-status`, in batches (`config.ixly_batch_per_run`)
4. **Reminders** — via `/api/grovia-herinnering`, met een bovengrens per run
5. **Dashboard** verversen
6. **Financieel-rapport** verversen
7. **MiniMove** — aankopen + aanwezigheid bijwerken, hergebruikt de orderregels van stap 6
8. **Ixly-scores + teamindeling** — via `/api/ixly-scores` nieuwe scores ophalen voor kinderen met `ixly_af = JA` en een gevulde `ixly_taken` maar nog zonder score, wegschrijven in `Ixly Scores`, en daarna de teamindeling (leeftijdsgroep, totaalscore, ranking, groepsindeling) herberekenen en wegschrijven naar de werkboeken per vereniging — zie hieronder

Kernregel: als de data van stap 1–3 niet betrouwbaar is, gaan er in stap 4 **geen** reminders uit. Een gemiste dag kost niets; een reminder naar een kind dat de test gisteren maakte kost vertrouwen. Stap 7 en stap 8 vangen hun eigen fouten af en gooien ze niet door: een MiniMove- of Ixly-scores-storing mag de reminders van diezelfde run niet blokkeren. Na elke stap wordt tussentijds weggeschreven, zodat een afgebroken run (6-minutenlimiet) niets verliest.

#### De order-meta-brug

De publieke Ixly-API heeft geen endpoint om de assignments van een kandidaat op te vragen. `ixly-aanmelding` bewaart daarom bij het aanmaken `naam:assignment_uuid`-paren als WooCommerce order-meta `_grovia_ixly_taken`; `ixly-status` en `grovia-herinnering` lezen die terug en bevragen per taak het wél werkende `GET /assignments/{uuid}`. WooCommerce is hier dus de opslag voor Ixly-identifiers. Zie ADR-008.

#### Financieel-rapport

[`Financieel.gs`](../google-apps-script/deelnemers/Financieel.gs) rekent afdracht per vereniging × cyclus (€20 per deelnemer per cyclus, excl. btw), met keepers en spelers apart en omzet incl./excl. 9% btw.

Twee bewuste afwijkingen van de rest van het systeem: het rekent op **orderregelniveau** (`haalOrderRegels()` in `Woo.gs`), niet vanuit het Deelnemers-tabblad, zodat losse cyclusaankopen door hetzelfde kind in elke cyclus meetellen. En het gebruikt een **eigen seizoensgrens van 1 juni**, los van `bepaalSeizoen()`'s 1 augustus, omdat cyclusverkoop al in juni/juli begint. `Financieel.gs` roept `bepaalSeizoen()` daarom nergens aan. Zie ADR-009.

Sinds ADR-015 kan WooCommerce per kind overruled worden: een gevulde `bedrag_correctie`-kolom in Deelnemers (handmatig, direct na `bedrag`) geldt als seizoenstotaal van dat kind en wordt naar rato over zijn meetellende orderregels verdeeld (gelijk verdeeld bij nul Woo-omzet, zoals een 100%-kortingscode). Leeg = WooCommerce telt; `0` = expliciet nul.

Cyclus of seizoenkaart komt uit de variatie-attribuutmeta `pa_inschrijving` (ruwe slug, bijv. `cyclus-1`), vertaald via `mapping.fases`.

#### Teamindeling — "Ixly Scores" en de werkboeken per vereniging

Vervangt de handmatige Excel-teamindeling ("Complexiteit berekening.xlsx") door een geautomatiseerde keten: Blocks- en Rally-scores ophalen, bewaren, wegen tot een totaalscore en per vereniging een gerangschikte groepsindeling wegschrijven. De trainer houdt het laatste woord. Zie [design-spec](superpowers/specs/2026-08-18-teamindeling-ixly-scores-design.md) en [implementatieplan](superpowers/plans/2026-08-18-teamindeling-ixly-scores.md).

**Tabblad "Ixly Scores" (hoofdwerkboek).** [`Scores.gs`](../google-apps-script/deelnemers/Scores.gs) verzamelt de rijen met `ixly_af = JA` waarvan de score nog ontbreekt, roept `/api/ixly-scores` aan en vertaalt Ixly's Engelse sleutels naar 16 kolommen: `seizoen` (sleutel is `seizoen|naam_slug` sinds ADR-015 — een terugkerend kind wordt volgend seizoen opnieuw bevraagd en ingedeeld), `naam_slug`, `naam_kind`, de 2 blocks-schalen (`blocks_planning`, `blocks_flexibiliteit`), de 7 rally-schalen (`rally_prestatie`, `rally_kwaliteit`, `rally_reactiesnelheid`, `rally_consistentie`, `rally_volgehouden_aandacht`, `rally_respons_inhibitie`, `rally_reactie_op_fouten`), `levels_voltooid`, `levels_perfect`, `bron`, `opgehaald_op`. Scores worden **één keer opgehaald en daarna bewaard** — een kind met een score wordt niet opnieuw bij Ixly bevraagd. `bron` is `api` of `handmatig`; staat er `handmatig` (voor de ~30 legacy-kandidaten zonder bewaarde assignment-uuid, handmatig overgenomen uit de oude Excel-sheet), dan blijft de rij met rust en vult het systeem alleen nog lege cellen aan — hetzelfde vul-als-leeg-patroon als bij `geboortedatum_kind`/`club`/`team`.

**Werkboeken per vereniging.** [`Teams.gs`](../google-apps-script/deelnemers/Teams.gs) segmenteert op vereniging × leeftijd (Config-grens per rol in `AB:AC`, sinds ADR-015-addendum per academie te overrulen via `AO:AQ`) × rol (`MM` doet niet mee, zelfde uitsluiting als bij `upsertDeelnemers`), berekent per kind de gewogen totaalscore (Config-wegingen per schaal) en rangschikt. Een apart Google Spreadsheet per vereniging (werkboek-ID in Config) krijgt vijf tabbladen: **jong voetbal**, **oud voetbal**, **jong keeper**, **oud keeper** en **"Zonder indeling"** voor kinderen zonder geboortedatum of zonder volledige set van negen schalen. Elk van de vier hoofdtabbladen bevat naam, geboortedatum, club, team, de negen genormeerde schalen, de twee leveltellingen (getoond, niet meegewogen), totaalscore, ranking, `voorgestelde_groep` en `definitieve_groep` (de trainer mag overrulen; een dagelijkse herberekening leest `definitieve_groep` eerst per `naam_slug` in en zet die terug — matchen op naam, nooit op rijnummer) en `bijgewerkt_op`. De trainerswerkboeken bevatten **bewust geen ouder-e-mailadressen en geen bedragen** — trainers zien alleen wat ze nodig hebben om een team samen te stellen.

### 6. Action Type-test (Google Forms + Apps Script)

Per vereniging een Google Form met gekoppelde antwoordsheet; scoring via `ARRAYFORMULA` in een apart "Resultaten"-tabblad. De uitnodigingsmail bevat een prefilled link (`bouw_prefill_url()`), gevuld met de controlecode en de naam van het kind — vandaar de `ACTION_TYPE_ENTRY_*`-env vars met de form-entry-ID's.

Zie [ACTION-TYPE-TEST.md](ACTION-TYPE-TEST.md) voor de vragen en scoring.

**Gotcha:** de kolomindex van de controlecode in de antwoordsheet is pas definitief nadat het formulier is opgeschoond. Een gedeelde snapshot tijdens het opruimen kan een tussentijdse kolomvolgorde tonen; vraag bij een indexwijziging expliciet of dit de definitieve staat is.

## Infrastructuur

_Hosting, omgevingen (dev/prod), secrets-beheer._

## Externe koppelingen

| Service | Doel | Documentatie |
|---|---|---|
| FunnelKit Automations | E-mailflows | — |
| Ixly Assessments API | Assessment aanmeldingen | — |
| WooCommerce API (WCAPI) | Productdata uitlezen | — |
| Azure Functions | Serverless backend logica | — |
| Google Apps Script / Sheets | Deelnemersadministratie, reminders, financieel rapport | — |
| Breakdance | Pagebuilder voor contentpagina's op grovia.nl | — |
| Azure SQL Database | Data warehouse | — |
| PowerBI | Visualisaties | — |
