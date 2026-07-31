# Ixly-afronding repareren: assignment-uuid's bewaren i.p.v. opnieuw opzoeken — ontwerp

**Datum:** 2026-08-01
**Status:** Goedgekeurd, klaar voor implementatieplan

## Probleem

Live getest tegen een echte, bevestigd afgeronde Ixly-candidate ("Jip van Essen", order 1195,
beide games afgerond op 7 juli 2026 volgens de Ixly-webinterface): `ixly-status` gaf
`{"gevonden": true, "af": false, "taken": []}` terug — de candidate wordt gevonden, maar er komen
nul taken uit.

**Root cause, bevestigd via een tijdelijke debug-deploy (teruggedraaid) en de officiële
Ixly-swagger:** de publieke Ixly-API heeft géén manier om de assignments van een candidate op te
vragen. `GET /api/public/assignments` heeft in de specificatie alleen een `post`-methode
(aanmaken); er is geen lijst/filter-endpoint, geen embedded assignments op het
candidate-object, en geen filter op `candidate_tasks`. De aanroep die `ixly_api.haal_assignments`
gebruikt (gekopieerd uit het al langer bestaande, nooit in de praktijk geteste
duplicaat-guard in `ixly-aanmelding`) roept dus een niet-gedocumenteerd endpoint aan dat altijd
een lege lijst teruggeeft.

**Bijkomende vondst:** `grovia-herinnering` gebruikt voor het opnieuw ophalen van de
`login_url`'s in een reminder-mail dezelfde kapotte aanroep (`haal_assignments`). Een reminder
over nog niet afgeronde Ixly-games gaat dus vermoedelijk altijd zonder werkende spel-linkjes de
deur uit. De eerdere gamenaam-fix (Task 5, `TAAK_NAMEN`) vergelijkt bovendien een vaste
spel-definitie-uuid tegen een per-aanmelding-unieke relatie-uuid, en matcht daardoor
waarschijnlijk ook nooit.

**Wat wél werkt, bevestigd in de swagger:** `GET /api/public/assignments/{uuid}` — een
single-resource GET op de assignment's eigen uuid. Die geeft zowel `links.login_url` als de
`relationships` (met de specifieke `candidate_task`/`candidate_program`/`candidate_process`-uuid)
in één keer terug. Dit endpoint is nooit bereikt omdat niemand de assignment-uuid ooit heeft
bewaard — `ixly-aanmelding` kent hem wel (`assignment["id"]`, nu al in zijn eigen respons als
`assignment_uuid`), maar niemand slaat hem ergens op.

## Oplossing

`ixly-aanmelding` weet op het moment van aanmaken exact welk spel bij welke assignment-uuid
hoort (hij doorloopt zijn eigen vaste `TAKEN`-lijst). Die combinatie — naam + assignment-uuid —
wordt voortaan bewaard als WooCommerce order-meta, zodat de rest van de keten die later kan
gebruiken in plaats van te proberen hem te reconstrueren via het kapotte lijst-endpoint.

## Beslissing: geen terugvulling van bestaande candidates

De ~31 rijen die al vóór deze fix zijn aangemaakt, hebben geen bewaarde assignment-uuid's — die
informatie is destijds nooit vastgelegd, en om hem nu op te zoeken is precies het kapotte
endpoint nodig dat dit probleem veroorzaakt. Voor die rijen blijft Ixly-afronding permanent
handmatig te controleren, net als de bestaande aanpak bij niet-gekoppelde Action Type-reacties.
Deze fix werkt vanaf nu voor alle **nieuwe** orders.

## Dataflow

1. **`ixly-aanmelding` (Python) — ongewijzigde respons.** De functie retourneert al
   `{"candidate_uuid": ..., "assignments": [{"naam": ..., "assignment_uuid": ..., "login_url": ...}]}`.
   Geen wijziging aan de bestaande logica of respons nodig — alleen een nieuwe stap ná het
   aanmaken van de assignments: **de eigen WooCommerce-order bijwerken** met een nieuw
   meta-veld, via een nieuwe, schrijfbare WooCommerce REST-sleutel (Azure App Settings,
   bijv. `GROVIA_WOO_CONSUMER_KEY`/`GROVIA_WOO_CONSUMER_SECRET`). Bewust een aparte sleutel
   van de bestaande alleen-lezen sleutel die Apps Script gebruikt: die laatste hoort
   alleen-lezen te blijven (least-privilege — de Sheet is deelbaar), dus krijgt Azure een
   eigen, schrijfbare sleutel in plaats van de bestaande te verruimen.

   **Waarom in `ixly-aanmelding` zelf, en niet in de aanroeper:** deze functie wordt op twee
   manieren getriggerd — direct vanuit `grovia-assessment-router.php` (PHP, heeft native
   WooCommerce-toegang), én vanuit `mollie-webhook` (Python, na een geslaagde betaling voor
   de C2/C3-fases) — en `mollie-webhook` heeft **geen** WooCommerce-schrijftoegang. Door de
   order-meta-schrijfactie in `ixly-aanmelding` zelf te zetten, hoeft die logica maar op één
   plek te bestaan, ongeacht welke route een order neemt.

2. **Order-meta `_grovia_ixly_taken`.** Formaat: `naam:assignment_uuid`-paren,
   komma-gescheiden — bijv. `Blocks Game:39e7d2a1-...,Rally Game:8a4f9c22-...`. Zelfde stijl
   als de bestaande `order_ids`-kolom in de Sheet.

3. **`Woo.gs` (Apps Script)** leest dit veld net zo mee als `Naam kind`, en geeft het door aan
   `upsertDeelnemers` als nieuw veld `ixly_taken` op een nieuwe rij. Bestaande orders zonder
   dit meta-veld krijgen een lege waarde.

4. **`Deelnemers`-tabblad** krijgt een 19e kolom, `ixly_taken`, achteraan (net als
   `ixly_laatste_gecontroleerd_op` eerder) — niet ertussen, om de al ingevulde kopregel niet te
   verstoren.

5. **`IxlyStatus.gs`** geeft bij de aanroep naar `ixly-status` niet langer alleen order-id's mee,
   maar per rij ook de `taken`-lijst uit `ixly_taken`. Rijen zonder `ixly_taken` worden door
   `kiesTeControlerenIndexen` uitgesloten — die blijven permanent handmatig.

6. **`ixly-status` (Python) — nieuw request/response-contract:**

   ```json
   {"orders": [
     {"order_id": "1195", "taken": [
       {"naam": "Blocks Game", "assignment_uuid": "39e7d2a1-..."},
       {"naam": "Rally Game",  "assignment_uuid": "8a4f9c22-..."}
     ]}
   ]}
   ```

   Voor elke taak: `GET /assignments/{assignment_uuid}` (ontdekt welke van
   `candidate_task`/`candidate_program`/`candidate_process` gevuld is, en zijn uuid), gevolgd
   door de al bestaande, bewezen werkende `GET /{soort}/{uuid}` (`ixly_api.haal_taak_status`,
   ongewijzigd) voor `state` + `completed_at`. `_bepaal_afronding` (pure logica, ongewijzigd)
   bepaalt of alles afgerond is. Respons blijft in vorm gelijk:
   `{"resultaten": {"1195": {"af": ..., "completed_at": ..., "taken": [...]}}}`.

   `zoek_candidate` en `haal_assignments` zijn in dit endpoint niet meer nodig.

7. **`grovia-herinnering`** krijgt dezelfde `taken`-lijst in zijn payload. `_haal_login_urls`
   wordt vervangen door een aanroep die per taak alleen `GET /assignments/{uuid}` gebruikt voor
   de `login_url` — geen matching op naam meer nodig, de naam staat al in de payload.
   `zoek_candidate`/`haal_assignments` en de `TAAK_NAMEN`-matching (Task 5) worden hier niet
   meer gebruikt.

## Nieuwe/gewijzigde functies in `grovia_shared/ixly_api.py`

- **Nieuw:** `haal_assignment(token, assignment_uuid) -> dict` — enkele `GET
  /api/public/assignments/{uuid}`, retourneert de ruwe data (met `relationships` en `links`).
- `haal_taak_status` — ongewijzigd, blijft gebruikt door `ixly-status`.
- `zoek_candidate`, `haal_assignments` (in `grovia_shared/ixly_api.py`) — worden ná deze fix door
  niets meer aangeroepen. **Let op:** `ixly-aanmelding` gebruikt deze gedeelde functies niet en
  heeft nooit gebruikt — dat bestand heeft zijn eigen, losstaande lokale implementaties
  (`_zoek_candidate_op`, `_haal_bestaande_assignments_op`), die ongemoeid blijven. De gedeelde
  `zoek_candidate`/`haal_assignments` werden alleen door `ixly-status` en `grovia-herinnering`
  gebruikt; na deze fix zijn ze in de hele codebase ongebruikt. Blijven staan als dode code
  tenzij Max ze wil laten opruimen — geen onderdeel van deze fix.
- `TAAK_NAMEN` (Task 5) — wordt niet meer gebruikt na deze fix. Blijft staan als ongebruikte
  code tenzij Max hem wil laten opruimen; geen onderdeel van deze fix.

## Foutafhandeling

- **De order-meta-schrijfactie in `ixly-aanmelding` mag de rest van de flow nooit blokkeren.**
  De assignments zijn op dat moment al succesvol aangemaakt in Ixly en de uitnodigingsmail moet
  nog verstuurd worden. Mislukt het wegschrijven (WooCommerce onbereikbaar, verkeerde sleutel),
  dan wordt dat gelogd en gaat de rest van de functie door zonder retry. Enige gevolg: die ene
  order valt terug op de handmatige Ixly-controle, net als de bestaande ~31 rijen.
- **In `ixly-status` blijft de bestaande regel gelden: één stukke taak of order blokkeert de
  rest niet.** Faalt `GET /assignments/{uuid}` voor één taak (bijv. een verouderde uuid), dan
  komt er een `fout` in het resultaat van die order, en de batch gaat door.
- **In `grovia-herinnering` blijft de bestaande terugval gelden** (Task 5): lukt het niet om een
  werkende link op te halen voor een taak, dan valt "ixly" uit `open_testen` voor die reminder.

## Testen

- **Python:** nieuwe/bijgewerkte tests voor `ixly_api.haal_assignment`, `ixly-status` (nieuw
  request/response-formaat, gemockte `haal_assignment`/`haal_taak_status`), `grovia-herinnering`
  (`_haal_login_urls` gebruikt nu `haal_assignment` direct), en `ixly-aanmelding` (de nieuwe
  WC-schrijfaanroep gemockt, plus een test die bevestigt dat een mislukking daarvan de rest van
  de flow — met name de uitnodigingsmail — niet blokkeert).
- **Apps Script:** `kiesTeControlerenIndexen` sluit rijen zonder `ixly_taken` uit;
  `upsertDeelnemers` geeft het nieuwe veld correct door aan nieuwe rijen (leeg voor bestaande).
- **PHP:** geen geautomatiseerde tests mogelijk in dit project (ongewijzigd) — alleen live te
  verifiëren.
- **Einde-tot-einde:** pas volledig te verifiëren met een **nieuwe** testorder na livegang
  (bewust geen terugvulling van bestaande candidates) — valt samen met de al geplande Task
  13-doorloop uit het reminder-project.

## Te verifiëren vóór implementatie

- Nieuwe, schrijfbare WooCommerce REST-sleutel aanmaken (WooCommerce → Instellingen →
  Geavanceerd → REST API), en als Azure App Settings zetten
  (`GROVIA_WOO_CONSUMER_KEY`/`GROVIA_WOO_CONSUMER_SECRET`) vóór livegang.

## Buiten scope

- Het terugvullen van assignment-uuid's voor de ~31 bestaande candidates (zie beslissing
  hierboven).
- Het dormant/vermoedelijk al sinds ADR-004 kapotte duplicaat-guard in `ixly-aanmelding`
  (`_haal_bestaande_assignments_op`, gebruikt om te voorkomen dat dezelfde assignment twee keer
  wordt aangemaakt). Dit wordt in de praktijk al afgedekt door de PHP-tag-guard die voorkomt dat
  `ixly-aanmelding` twee keer voor dezelfde order+kind wordt aangeroepen, dus geen acute
  productie-impact — maar het is wel dezelfde onderliggende oorzaak (kapot lijst-endpoint) en
  een aparte, losse fix waard.
- Het opruimen van `TAAK_NAMEN` en de bijbehorende matching-logica in `grovia_shared/ixly_api.py`
  (wordt ongebruikt na deze fix, maar verwijderen is geen onderdeel van deze opdracht).
