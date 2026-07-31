# Testuitnodigingen, reminders en deelnemersoverzicht — ontwerp

**Datum:** 2026-07-30
**Status:** Goedgekeurd, klaar voor implementatieplan

## Doel

Grovia inzicht geven in welke kinderen de testen wél en niet hebben gemaakt, automatisch
reminders sturen aan wie nog open staat, en de klant de mogelijkheid geven handmatig een
uitnodiging of reminder te versturen — zonder portal en zonder terminal.

Het gaat om **beide** testen:

| | Action Type test | Ixly games |
|---|---|---|
| Waar | Google Form (per vereniging) | Ixly-platform (Blocks + Rally) |
| Identiteit | tot nu toe een vrij tekstveld "Naam" | candidate met `api_identifier = order_id` |
| Afronding zichtbaar via | rij in de resultaten-sheet | `candidate_task.state` + `completed_at` |

## Uitgangssituatie

Wat er al staat, en wat dat betekent voor dit ontwerp:

- **De uitnodigingsmail bestaat al en is al automatisch.** Niet via FunnelKit, maar via SMTP
  vanuit de Azure Function `ixly-aanmelding` ([`ixly-aanmelding/__init__.py:264`](../../../ixly-aanmelding/__init__.py)).
  Dat is één gecombineerde mail met de Ixly-gamelinks én de Action Type-formulierlink,
  gestyled per vereniging. Alleen KA en SU krijgen die mail; MM krijgt wel assignments in
  Ixly maar geen mail.
- **De twee bestanden in [`email-templates/`](../../../email-templates/) zijn dood.** Ze zijn
  voor FunnelKit gemaakt en nooit in gebruik genomen; de Python-mail heeft ze vervangen.
  Opruimen valt buiten deze scope, maar ze zijn geen referentie.
- **Ixly-afronding is opvraagbaar.** `GET /api/public/candidates/api_identifier/{order_id}` →
  candidate, `GET /api/public/assignments?candidate_uuid=…` → assignments, en
  `candidate_task` levert `state` en `completed_at` ([`swagger.yaml:1355`](../../../swagger.yaml)).
- **Per-kind identiteit bestaat al in de tags.** De guard-tag `Assessment2526_freddie-rood`
  identificeert het kind per seizoen; de assessment-tag heeft het formaat
  `{school}{fase}{seizoen}_{naam_slug}_{order_id}` ([ADR-005](../../DECISIONS.md)).
- **FunnelKit kan géén link per kind maken.** Merge-tags bestaan alleen voor contactvelden, en
  één ouder kan meerdere kinderen hebben. De Azure Function heeft `naam_kind` en `order_id`
  wél in handen op het moment dat hij de mail opbouwt — daar hoort de vooringevulde link dus.

## Rolverdeling

| Onderdeel | Waar |
|---|---|
| Uitnodiging versturen | `ixly-aanmelding` (bestaat) — krijgt de controlecode in de Action Type-link |
| Reminders versturen | `grovia-herinnering` (nieuw) — zelfde SMTP, zelfde huisstijl |
| Ixly-afronding uitlezen | `ixly-status` (nieuw) |
| Bepalen wie wat nodig heeft | Google Sheet + Apps Script |
| Database, dashboard, knoppen | Google Sheet |

Reminders komen uit Azure en niet uit Apps Script om drie redenen: de mailopmaak blijft op één
plek, de afzender blijft gelijk, en de Ixly-`login_url`'s zijn nodig in de reminder terwijl die
nergens bewaard worden — de Function kan ze opnieuw ophalen, een Sheet zou daarvoor
Ixly-credentials nodig hebben.

## Componenten

### 1. Werkboek "Grovia Deelnemers" (Google Sheets)

In de bestaande Grovia Drive-map, naast de twee resultaten-sheets. Vier tabbladen plus twee
uitzonderingslijsten:

- `Deelnemers` — de database, één rij per kind per seizoen
- `Dashboard` — de optelsommen en de openstaande gevallen
- `Log` — één regel per verzendpoging, automatisch én handmatig
- `Config` — instellingen en mappingtabellen
- `Handmatig koppelen` — formulierreacties zonder controlecode
- `Controleren` — orders zonder bruikbare `Naam kind`

### 2. Apps Script-project

Gekoppeld aan dat werkboek, opgesplitst per verantwoordelijkheid:

| Bestand | Taak |
|---|---|
| `Config.gs` | Script Properties en het `Config`-tabblad uitlezen |
| `Woo.gs` | orders en producten ophalen via de WCAPI |
| `Deelnemers.gs` | rijen upserten op `seizoen` + `naam_slug` |
| `ActionType.gs` | reacties uit de twee resultaten-sheets koppelen |
| `IxlyStatus.gs` | `ixly-status` aanroepen en de kolommen bijwerken |
| `Reminders.gs` | bepalen wie wat krijgt, `grovia-herinnering` aanroepen |
| `Menu.gs` | het menu "Grovia" met de handmatige acties |
| `Dagelijks.gs` | de time-driven trigger die de stappen orkestreert |
| `Tests.gs` | asserts over de pure functies |

De beslissingslogica zit in pure functies zonder Sheet- of netwerktoegang
(`bepaalReminders`, `koppelReacties`, `upsertDeelnemers`); de wrappers die de Sheet en HTTP
aanraken blijven dom. Dat is de enige manier om deze logica binnen Apps Script testbaar te
houden.

### 3. Azure Functions (bestaand Python-project)

- `ixly-aanmelding` — **wijziging:** de controlecode wordt aan de Action Type-formulierlink
  toegevoegd, en de instructie "vul bij de vraag Naam de volledige naam in" verdwijnt uit de
  mail omdat dat veld nu vooringevuld is.
- `ixly-status` — **nieuw.** Order-id's in, per order de afrondingsstatus per taak uit.
  Afgerond betekent: álle taken afgerond.
- `grovia-herinnering` — **nieuw.** Verstuurt de remindermail via de bestaande SMTP en noemt
  alleen de nog openstaande testen.
- `grovia_mail.py` — **nieuw, gedeeld.** De mailopmaak zit nu inline in `ixly-aanmelding`; die
  wordt hierheen getrokken zodat de reminder dezelfde huisstijl gebruikt zonder duplicatie.

### 4. Google Forms

Beide formulieren krijgen één extra kort-antwoordveld **`Controlecode`**, dat via een
URL-parameter vooringevuld wordt. Het veld is zichtbaar (Google Forms kent geen verborgen
velden) en heet iets in de geest van "Controlecode — niet aanpassen".

Het `Naam`-veld blijft bestaan en wordt óók vooringevuld met de naam van het kind, zodat er
niets meer getypt hoeft te worden.

## De controlecode

**De controlecode is het `order_id`.** Geen hash, geen slug, niets te berekenen.

- Al uniek per aankoop
- Al de `api_identifier` in Ixly ([ADR-004](../../DECISIONS.md)), dus dezelfde sleutel voor beide testen
- Geen persoonsgegeven, dus het mag zonder bezwaar in een URL
- Geen enkel risico dat PHP, Python en Apps Script een naam net anders normaliseren

Een kind kan in principe de vooringevulde velden aanpassen of de link met een broer of zus
delen. Dat is een geaccepteerd risico: het gaat om een laagdrempelige persoonlijkheidstest,
niet om iets met een belang bij fraude.

## Datamodel — `Deelnemers`

Sleutel: `seizoen` + `naam_slug`. Dat is precies hoe de bestaande guard-tag
`Assessment2526_freddie-rood` het kind al identificeert. Een tweede order voor hetzelfde kind
in hetzelfde seizoen komt bij `order_ids` en maakt geen nieuwe rij.

**De `naam_slug` in de Sheet hoeft niet identiek te zijn aan die van PHP.** Apps Script
normaliseert de naam zelf, en die slug wordt nergens vergeleken met de guard-tag of met een
PHP-waarde — hij dient alleen als rij-identiteit binnen het werkboek. Vereiste is dus enkel dat
Apps Script consistent is met zichzelf, niet dat hij `grovia_naam_slug()` naboots.

| Kolom | Inhoud |
|---|---|
| `seizoen` | bijv. `2526` |
| `naam_slug` | bijv. `freddie-rood` |
| `naam_kind` | zoals de ouder het invulde |
| `vereniging` | `KA` of `SU` |
| `ouder_naam` | billing-naam |
| `ouder_email` | billing-e-mail, ontvanger van alle mails |
| `order_ids` | alle orders van dit kind dit seizoen |
| `code` | het laagste (chronologisch eerste) `order_id` — zie hieronder |
| `uitgenodigd_op` | datum van de eerste order van dit kind dit seizoen |
| `action_type_af` | ja/nee |
| `action_type_op` | datum van afronding |
| `action_type` | de lettercombinatie, bijv. `ISTJ` |
| `ixly_af` | ja/nee |
| `ixly_op` | datum van afronding |
| `reminders_verzonden` | teller, maximaal 5 |
| `laatste_reminder_op` | datum van de laatst geslaagde reminder |
| `laatste_poging_op` | datum van de laatste poging, ook een mislukte |
| `ixly_laatste_gecontroleerd_op` | datum van de laatste keer dat deze rij bij Ixly gecontroleerd is (leeg = nooit) — bepaalt de volgorde in de Ixly-batch, zodat elke openstaande rij op termijn aan de beurt komt (eindreview-fixronde, bevinding 3) |

Bewust een platte tabel zonder formules in de databasekolommen: dit is exact wat later één
`INSERT` per rij in Azure SQL wordt. Het `Dashboard`-tabblad doet de optelsommen, zodat data en
weergave los van elkaar te verplaatsen zijn.

### Waarom `code` het eerste order_id is

De router zet de guard-tag `Assessment{seizoen}_{naam_slug}` na de eerste geslaagde aanvraag, en
blokkeert daarmee elke volgende. Er gaat dus per kind per seizoen precies één uitnodiging uit, op
basis van de eerste order — en dat is ook het `order_id` dat als `api_identifier` bij Ixly
geregistreerd staat. `code` is daarom hetzelfde nummer voor de formulierlink én de Ixly-lookup.

### Waarom `uitgenodigd_op` de orderdatum is

De uitnodiging wordt door de router direct na de order verstuurd, dus de orderdatum en de
verzenddatum liggen minuten uit elkaar. De WCAPI levert de orderdatum, en die is dus nauwkeurig
genoeg om de reminderdrempels op te baseren.

Een **handmatig opnieuw verstuurde uitnodiging zet `uitgenodigd_op` niet terug** — de cadans
loopt door vanaf de oorspronkelijke datum. Wél wordt `laatste_reminder_op` gezet, zodat er de
volgende dag geen automatische mail bovenop komt.

Randgeval: is de Azure-call destijds mislukt, dan staat de order wel in WooCommerce maar heeft de
ouder nooit een uitnodiging gehad. Zo'n rij komt normaal in de reminderflow terecht, en omdat de
remindermail de links zélf bevat, herstelt dat zich vanzelf.

## Dataflow — de dagelijkse run

Eén time-driven trigger, vijf stappen in vaste volgorde. Elke stap leidt af wat er te doen is
uit de staat in de Sheet, dus een herhaalde run doet nooit dubbel werk.

### Stap 1 — Deelnemers ophalen

Via de WCAPI de orders sinds de vorige run, met een dag overlap, plus eenmalig de productlijst
om per order de vereniging te bepalen. Upsert per kind.

De regels voor welke producten meedoen — schoolcodes, de uitgesloten categorieën `evenement` en
`proef-training`, en de fasecodes — staan in PHP ([`grovia-automations.php:65`](../../../plugins/grovia-automations/grovia-automations.php)).
Apps Script heeft ze ook nodig en krijgt ze als **tabel in het `Config`-tabblad**, niet als code:
zo staan ze zichtbaar op één plek en zijn ze bij te werken zonder deploy.

**Geaccepteerde consequentie:** bij een nieuwe school of fase moet je het op twee plekken
bijwerken, PHP en `Config`. Het alternatief is een read-only endpoint in WordPress die de maps
uitleest, zodat er echt één bron is. Dat is netter maar een component erbij; overweeg het zodra
er een derde vereniging bijkomt.

Orders zonder bruikbare `Naam kind` gaan naar `Controleren` en niet in de automatische flow. Er
wordt niet gegokt. Dit is dezelfde open vraag als de TODO in
[`grovia-automations.php:94`](../../../plugins/grovia-automations/grovia-automations.php).

### Stap 2 — Action Type-afronding bijwerken

De reactie-tabbladen van beide bestaande resultaten-sheets worden gelezen en `Controlecode`
wordt gematcht op de `code`-kolom. Bij een match: `action_type_af`, `action_type_op` en de
lettercombinatie uit het `Resultaten`-tabblad.

Reacties zonder code — een oude link, of een leeggemaakt veld — landen op
`Handmatig koppelen` met de getypte naam erbij. Ze verdwijnen niet stil.

De bestaande sheets worden **alleen gelezen**. Er wordt niets in geschreven, dus we komen niet
in de buurt van de kolommen die Google Forms bij elke inzending overschrijft.

### Stap 3 — Ixly-afronding bijwerken

Voor open rijen wordt `ixly-status` aangeroepen met een batch order-id's. Het maximum per run
staat in `Config` als `ixly_batch_per_run` (voorstel: 50), om binnen de zesminutenlimiet van
Apps Script te blijven; wat vandaag niet lukt, gaat morgen mee.

### Stap 4 — Reminders

Drempels op **7, 14, 21, 35 en 49 dagen** na `uitgenodigd_op`, maximaal vijf per kind. Een rij
komt in aanmerking als niet zowel `action_type_af` als `ixly_af` waar is.

`grovia-herinnering` krijgt de ouder, het kind, de vereniging en welke testen nog open staan.
Eén mail noemt alleen wat open is: heeft het kind de Action Type wel gemaakt maar Ixly niet, dan
gaat de mail over Ixly. Geen twee losse reminderstromen.

`reminders_verzonden` gaat pas omhoog ná een HTTP 200 — hetzelfde patroon als de router, die de
guard-tag ook pas na een geslaagde call zet.

### Stap 5 — Dashboard verversen

Per vereniging: uitgenodigd, Action Type af, Ixly af, beide af, nog niets gedaan, en het aantal
verzonden reminders. Plus de gemiddelde doorlooptijd: het aantal dagen tussen `uitgenodigd_op` en
afronding, gerekend over alleen de kinderen die daadwerkelijk afgerond hebben — per test apart,
want de games kosten een uur en het formulier tien minuten.

Daaronder de openstaande gevallen, gesorteerd op hoe lang ze al liggen.

## Handmatige acties

Een eigen menu **"Grovia"** in de Sheet:

1. Reminder sturen naar de geselecteerde rijen
2. Uitnodiging opnieuw sturen naar de geselecteerde rijen
3. Alles nu verversen

Altijd eerst een bevestigingsvenster met hoeveel mails naar wie gaan.

Een handmatige reminder verbruikt **geen** van de vijf automatische pogingen, maar zet wél
`laatste_reminder_op` — anders krijgt een ouder de volgende dag alsnog de automatische mail
bovenop de handmatige duw. Elke verzending komt in `Log`, met de vermelding of hij automatisch
of handmatig was.

## Foutafhandeling

**Geen reminders bij onbetrouwbare data.** Faalt stap 1, 2 of 3, dan wordt stap 4 volledig
overgeslagen. Een gemiste dag kost niets, want morgen loopt de run weer. Een reminder naar een
kind dat de test gisteren gemaakt heeft, kost het vertrouwen van de klant in het hele systeem.

**Geen halve staat per rij.** Faalt één order of één statuscall, dan blijft die rij
onaangeroerd, komt de reden in `Log`, en gaat de run door met de volgende.

**Mislukte verzending wordt opnieuw geprobeerd.** De teller gaat alleen omhoog na een HTTP 200.
Bij een mislukking wordt `laatste_poging_op` gezet zodat de volgende dagelijkse run het opnieuw
probeert en niet vandaag nog eens. Ergste geval is één extra mail bij een dubieuze respons; de
omgekeerde keuze zou betekenen dat een ouder nooit meer een reminder krijgt omdat de SMTP-server
één keer hikte.

**Geen mailexplosie bij de eerste run.** Bij het vullen van de Sheet staan er kinderen in die al
maanden open staan en die alle vijf de drempels tegelijk zouden passeren. Daarom een
`startdatum` in `Config`: rijen met een uitnodiging van vóór die datum krijgen nooit automatische
reminders, alleen handmatig. Daarnaast een harde bovengrens `max_mails_per_run` in `Config`
(voorstel: 25), en als die geraakt wordt komt dat expliciet in het log — geen stille afkap die
eruitziet als "klaar".

**Secrets.** De WCAPI-sleutels en de Azure-functiesleutels gaan in de **Script Properties** van
Apps Script. Niet in de code, en met name niet in een cel in de Sheet: een Sheet is deelbaar, en
een sleutel in een cel ligt op straat zodra iemand leesrechten krijgt. De Ixly-credentials
blijven in de Azure App Settings.

## Testen

**Python** volgt het patroon van [`test_ixly_aanmelding.py`](../../../test_ixly_aanmelding.py) met
pytest en gemockte Ixly-calls:

- `ixly-status` bij alles afgerond, deels afgerond, onbekende candidate en een 404
- `grovia-herinnering` noemt alleen de nog openstaande testen
- `grovia_mail.py` levert dezelfde opmaak op als de huidige inline-versie

**Apps Script** heeft geen testframework, dus de pure functies worden getest via `Tests.gs` met
gewone assert-helpers, te draaien vanuit de editor:

- `bepaalReminders` respecteert de drempels, het maximum van vijf, de `startdatum` en de
  bovengrens per run
- `koppelReacties` matcht op code en legt codeloze reacties apart
- `upsertDeelnemers` voegt een tweede order toe aan een bestaand kind in plaats van een nieuwe rij

**Een `TESTMODUS`-vlag in `Config`** stuurt alle remindermail naar één adres. Bewust benoemd,
gedocumenteerd en standaard uit — dat is de les van `GROVIA_DEBUG_EMAIL`, die precies dit doet
maar waarvan niet vaststaat of hij aan staat.

**Eén echte end-to-end doorloop** voor livegang: één testkind, order plaatsen, uitnodiging met
code ontvangen, formulier invullen, controleren of de rij omklapt, dan `uitgenodigd_op`
terugzetten en kijken of de reminder uitgaat.

## Te verifiëren vóór implementatie

1. **Staat `GROVIA_DEBUG_EMAIL` gevuld in de Azure App Settings?** Zo ja, dan gaat elke
   uitnodiging naar dat ene adres en heeft nog geen enkele ouder de mail ontvangen — dan bouwen
   we reminders op een uitnodiging die niemand kreeg. Te herkennen aan het onderwerp van de
   mails die binnenkomen: "Tijd voor de Grovia games en de Action Type test" is klantmail,
   "Grovia Tag Callback — debug log" is de PHP-debuglog.
2. **WCAPI-credentials aanmaken** in WooCommerce (read-only) voor de Script Properties.
3. **Bevestigen dat MM buiten scope blijft.** MiniMove krijgt geen Action Type-mail en, met de
   nog niet gecommitte wijziging in [`grovia-automations.php:179`](../../../plugins/grovia-automations/grovia-automations.php),
   ook geen assessment-tag. MM-kinderen komen dus niet in de Sheet.

## Buiten scope

- Azure SQL en PowerBI. De `Deelnemers`-tab is bewust het datamodel dat daar later naartoe
  migreert, maar die migratie zelf hoort bij het datawarehouse-traject.
- Het opruimen van de ongebruikte [`email-templates/`](../../../email-templates/).
- De debug-mail met klantdata in de PHP-plugins ([`grovia-automations.php:259`](../../../plugins/grovia-automations/grovia-automations.php)
  en [`grovia-assessment-router.php:286`](../../../plugins/grovia-automations/grovia-assessment-router.php)).
  Losse taak.
- Teamindeling en -ranking op basis van de uitslagen.
