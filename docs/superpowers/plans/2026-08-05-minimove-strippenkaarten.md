# MiniMove-strippenkaarten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Opgesteld:** 2026-08-04 (avond, autonoom) · **Bedoeld voor implementatie:** 2026-08-05 · **Auteur:** Claude, in opdracht van Max

**Goal:** MiniMove van één te dure, inflexibele cyclusprijs naar drie strippenkaarten (4/6/8 keer) die binnen één cyclus van 8 trainingen opgemaakt worden — met zo weinig mogelijk wijziging aan de bestaande automatisering.

**Architecture:** De kern van het antwoord is dat de bestaande automatisering **al blind is voor MiniMove** — op drie onafhankelijke plekken, alle drie bewust. Nieuwe MiniMove-productvarianten raken daardoor géén enkel bestaand codepad. Spoor 0 (de productstructuur in WooCommerce) is nul regels code. De rest van dit plan is optioneel en opgesplitst in vier losse sporen die je in willekeurige volgorde en onafhankelijk kunt doen — of laten.

**Tech Stack:** WooCommerce (variabele producten + variatie-attributen), PHP (WordPress plugins, handmatige upload), Google Apps Script + Sheets (`node --test` voor de pure logica), FunnelKit Automations.

## Global Constraints

- **Voertaal is Nederlands** — code, comments, commits, docs. Ook variabelenamen.
- **Nooit secrets in code.** Apps Script → Script Properties; WordPress → `wp-config.php`; Azure → GitHub Secrets (ADR-003).
- **De WordPress-plugins hebben geen deploy-pipeline.** Elke PHP-wijziging is pas live na een handmatige upload. Reken daar bewust op in de volgorde van werken.
- **CONVENTIONS-regel 2: nooit per-rij WooCommerce-aanroepen.** Bulk ophalen, lokaal opzoeken. Twee volledige catalogus-ophalingen binnen één run gaven eerder al een 403 van de WAF.
- **CONVENTIONS-regel 3: elke kolom die tekst moet blijven krijgt een expliciet tekstformaat (`@`) bij het schrijven.** `String()` bij het teruglezen is niet genoeg. Dit is al drie keer een productiebug geweest (datum, seizoen, `order_ids`).
- **De cyclus is 8 trainingen.** Overal in code als één constante (`STRIPPEN_PER_CYCLUS`), nooit als los getal 8 in een formule.
- **Apps Script-testcommando: `node --test tests/gs/*.test.js`** — let op: de directory-vorm `node --test tests/gs/` staat wel zo in de docblocks van de bestaande testbestanden, maar **faalt op de Node hier** (v23.9.0) met `Cannot find module .../tests/gs`. Geverifieerd op 2026-08-04, ook op ongewijzigde `main`. Gebruik de glob. · **Python: `venv/bin/pytest tests/ -q`** (`python3.11 -m pytest` faalt hier met `No module named pytest` — pytest zit alleen in de venv) · **Build:** `func start`
- **Geen derde seizoensbegrip.** Er bestaan al bewust twee grenzen (1 juni voor Financieel, 1 augustus voor de deelnemersadministratie — zie GLOSSARY). Sluit aan bij één van die twee; introduceer geen nieuwe.

---

## Voorgeverifieerd op 2026-08-04

De code in Spoor 2 en Spoor 4 is niet alleen opgeschreven maar ook **echt gedraaid**, in een
wegwerpkopie van de repo buiten je werkmap. `Strippen.gs`, `strippen.test.js` en de vier nieuwe
Financieel-tests komen letterlijk uit die geverifieerde versie.

| Wat | Uitkomst |
|---|---|
| Baseline `main`, ongewijzigd | 84 tests, 84 passed |
| Met `Strippen.gs` + `strippen.test.js` + de Financieel-wijzigingen | **111 tests, 111 passed, 0 failed** |
| `func start` op ongewijzigde `main` | host start, zes functions geregistreerd |
| `venv/bin/pytest tests/ -q` op ongewijzigde `main` | 105 passed |

Twee dingen kwamen daarbij boven die niet in de code zaten maar wel in het plan horen:

1. **`node --test tests/gs/` werkt niet meer** op de Node op deze machine (v23.9.0) — ook niet op
   ongewijzigde `main`. Gebruik `node --test tests/gs/*.test.js`. De docblocks in de bestaande
   testbestanden noemen nog de directory-vorm; dat is bestaande drift, geen gevolg van dit werk.
   Hetzelfde geldt voor Python: `python3.11 -m pytest` geeft `No module named pytest`, want
   pytest zit alleen in de venv. Gebruik `venv/bin/pytest tests/ -q`.
2. **Twee kaarten in één order** liet mijn eerste opzet de helft van de strippen verliezen — de
   `order_ids`-dedup pakte de tweede regel af. Vandaar de voorbewerking per (order, kind, cyclus)
   in `upsertStrippen` en een test die dat vastlegt. Zonder die stap zou je dit pas gemerkt hebben
   als een ouder erover belde.

Wat **niet** geverifieerd is, en waarom: `Sheet.gs`, `Config.gs`, `Dagelijks.gs` en `Woo.gs`
raken `SpreadsheetApp`/`UrlFetchApp` en zijn buiten Apps Script niet te draaien — dat is precies
waarom dit codebase de pure logica in eigen bestanden houdt. Spoor 0 en de PHP-wijziging van
Spoor 1 vragen WooCommerce- en WordPress-toegang. Daar is de verificatie handmatig, via de
testchecklist onderaan.

## Deel 0 — Kernbevinding: de automatisering is al blind voor MiniMove

Dit is het antwoord op je vraag "hoe kunnen we dit zonder al te veel aanpassingen toepassen?". Bewijs, met bestand en regel:

| Onderdeel | Wat er met MiniMove gebeurt | Waar |
|---|---|---|
| Assessment-tag (Ixly/Action Type) | `continue` op schoolcode `MM` — MiniMove doet niet mee | [grovia-automations.php:182](../../../plugins/grovia-automations/grovia-automations.php:182) |
| Deelnemersadministratie | `return` op vereniging `MM` — komt niet in de sheet | [Deelnemers.gs:74](../../../google-apps-script/deelnemers/Deelnemers.gs:74) |
| Financieel-rapport | `VERENIGINGEN = ['KA','SU']` — MM komt er nooit in voor | [Financieel.gs:70](../../../google-apps-script/deelnemers/Financieel.gs:70) |
| Fysio-toestemmingsvinkje | Alleen bij categorie `toestemming-vereist`; MiniMove heeft die niet | [grovia-fysio-toestemming.php:14](../../../plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php:14) |
| WhatsApp-groepsuitnodiging | **Werkt wél en blijft werken** — zie hieronder | [grovia-automations.php:152](../../../plugins/grovia-automations/grovia-automations.php:152) |

**Waarom de WhatsApp-uitnodiging blijft werken, ongeacht wat je met de varianten doet.** De trigger-tag `WA_MM_VT` wordt op regel 152 verzameld, en dat is *vóór* alle drie de `continue`-regels (fase niet gevonden op 169, uitgesloten categorie op 174, MiniMove op 182). Die volgorde is bewust zo gebouwd — de comment op regel 180-181 zegt het expliciet. Nieuwe varianten met een onbekende `pa_inschrijving`-waarde vallen op regel 169 uit, ná het verzamelen van de WhatsApp-tag. **Geen regressie.**

### Wat dat betekent

Je kunt de drie strippenkaarten **volledig in WooCommerce** aanmaken en er verandert nul in de automatisering. Geen PHP-upload, geen Apps Script-wijziging, geen deploy. Dat is Spoor 0 en dat is het enige verplichte spoor.

### De vier dingen die daar wél aan hangen

1. **De debug-log gaat liegen.** Een onbekende `pa_inschrijving` valt uit op regel 169 met de melding `OVERGESLAGEN: school of fase niet gevonden voor dit product`. De echte reden is "MiniMove doet niet mee", en die staat 13 regels lager. Elke MiniMove-order levert bovendien een mail aan `GROVIA_DEBUG_EMAIL` (`max@greit.nl`, [regel 18](../../../plugins/grovia-automations/grovia-automations.php:18) — die define staat er als **TIJDELIJK** in en lekt klantdata naar die inbox). Spoor 1 lost de misleidende melding op.

2. **Een stille valkuil zodra strippenkaarten óók voor KA/SU komen.** De MM-check staat *na* de fase-check. Een KA- of SU-kind met een onbekende fase-slug valt uit op regel 169 en krijgt daardoor **geen assessment-uitnodiging** — zonder foutmelding, alleen een regel in een debug-log. Precies de klasse bug die eerder élke Action Type-inzending in "Handmatig koppelen" liet belanden. Spoor 1 dicht dit vooraf.

3. **Het Financieel-rapport laat onbekende inschrijvingen stil vallen.** [Financieel.gs:119-122](../../../google-apps-script/deelnemers/Financieel.gs:119): `bepaalInschrijvingType` geeft `''` terug voor een onbekende slug en de regel wordt overgeslagen. Voor MiniMove maakt dat vandaag niets uit (MM staat toch niet in het rapport), maar het is wel de reden dat strippenkaart-omzet nergens zichtbaar wordt. Spoor 3 als je dat wilt.

4. **"Afnemen in de cyclus" bestaat nog niet.** Er is nergens in het project presentie- of verbruiksregistratie. Dit is het enige echt nieuwe stuk functionaliteit. Spoor 2.

---

## Deel 1 — Beslissingen die jij moet nemen

Ik heb hier geen vragen kunnen stellen, dus elke keuze staat als optie met een aanbeveling. **Kies B1 t/m B3 vóór je begint** — die bepalen de productstructuur en die wil je niet twee keer aanmaken. B4 t/m B6 kun je later nemen.

### Bevestigd door Max — 2026-08-05

| # | Beslissing | Uitkomst |
|---|---|---|
| B1 | Variantstructuur | **Niet expliciet beantwoord.** Ik ga uit van A1 (mijn aanbeveling) — zie de rode vlag direct onder de tabel hieronder. |
| B2 | Prijzen | **Bevestigd:** 4 keer € 50, 6 keer € 70, 8 keer € 85. |
| B3 | Vervallen na de cyclus | **Bevestigd:** ja. |
| B4 | Wie streept af | **Bevestigd:** begin met optie 1 (handmatige lijst door de trainer). Spoor 2 (`Strippen`-tabblad) blijft klaarliggen — gebouwd en getest, niet nu ingepland. |
| B7 *(nieuw)* | Eenmalig inschrijfgeld € 20 | Buiten dit plan: Berry stuurt zelf een Mollie-link, los van de webshop-checkout. Zie B7 hieronder. |
| B8 *(nieuw, herzien)* | Tenue bij eerste aanmelding | **Bestaat al** op andere producten (live JS, niet in git). Verschijnt niet automatisch bij de nieuwe strippenkaarten — één regel in dat bestaande script verbreden lost het op. Zie Spoor 5 (herzien). |

### B1 — Hoe dragen de varianten de strippenkaart? ⚠️ blokkerend

| Optie | Hoe | Voor | Tegen |
|---|---|---|---|
| **A1 — één attribuut, geen cyclus in de variant** ⭐ | `pa_inschrijving` = `strippenkaart-4-keer` / `-6-keer` / `-8-keer` | 3 varianten, één dropdown, nul nieuwe meta-sleutels, alle bestaande lezers werken ongewijzigd | De cyclus staat niet in de order; wie de cyclus wil weten leidt die af uit de orderdatum (cyclus-kalender, Spoor 2) |
| A2 — één attribuut, cyclus in de slug | `cyclus-1-strippenkaart-4` … (9 varianten) | Cyclus expliciet in de order, geen kalender nodig | 9 varianten en 9 mappingregels; lelijke slugs; ouder kiest een cyclus die misschien al loopt |
| B — twee attributen | `pa_inschrijving` = cyclus + nieuw `pa_strippenkaart` = 4/6/8 | Schoonste semantiek; cyclus én kaartgrootte los uitdrukbaar | **Kost juist code:** [Woo.gs:94](../../../google-apps-script/deelnemers/Woo.gs:94) en de PHP lezen alléén `pa_inschrijving`; twee dropdowns op de checkout |
| C — drie losse simpele producten | Geen variatie-attribuut | Simpelst in WooCommerce | `pa_inschrijving` ontbreekt volledig; geen "kies je maat"-productpagina; drie losse regels in de shop |

**Aanbeveling: A1.** Het past bij hoe MiniMove verkoopt (één lopende cyclus), houdt de checkout op één dropdown en vereist nul aanpassing aan de lezers — precies wat je vroeg. Kies A2 of B alleen als Grovia cycli **vooruit** verkoopt en de ouder de cyclus zelf moet kiezen.

> ⚠️ **Van je drie antwoorden ontbrak deze.** Je beantwoordde B2 (prijzen), B3 (vervallen) en B4 (wie streept af) expliciet, maar B1 niet. Ik ga uit van **A1** en heb Spoor 0/1/2 daarop gebaseerd — inclusief de exacte slugs hieronder. Klopt dat gewoon, dan hoef je niets te doen. Verkoopt Grovia de cycli **vooraf** (de ouder kiest zelf "Cyclus 1" i.p.v. dat de cyclus uit de aankoopdatum volgt), zeg dat dan vóór je de attributen in WooCommerce aanmaakt — dat is de enige beslissing in dit plan die achteraf duur is om terug te draaien.

De rest van dit plan gaat uit van A1 met deze exacte slugs:

```
strippenkaart-4-keer
strippenkaart-6-keer
strippenkaart-8-keer
```

### B2 — Prijs per strippenkaart ✅ bevestigd

**Definitieve prijzen (2026-08-05):**

| Kaart | Prijs | Per strip |
|---|---|---|
| 4 keer | € 50,00 | € 12,50 |
| 6 keer | € 70,00 | € 11,67 |
| 8 keer | € 85,00 | € 10,63 |

Dit volgt precies het patroon dat ik aanraadde: de prijs per strip daalt naarmate de kaart groter is (€ 12,50 → € 11,67 → € 10,63), dus er is een reële prikkel om de 8-kaart te kiezen boven twee keer een 4-kaart. Zet deze drie bedragen in Task 2, stap 4.

Btw blijft een punt voor de boekhouder, niet voor de code: 9% op sporttraining (staat al als `FINANCIEEL_BTW_PERCENTAGE` in [Financieel.gs:27](../../../google-apps-script/deelnemers/Financieel.gs:27)), verschuldigd bij verkoop van de kaart — niet bij het afstrepen van een strip, want de kaart is een vooruitbetaling.

### B3 — Vervallen de strippen aan het einde van de cyclus? ✅ bevestigd: ja

Zoals aanbevolen: **ongebruikte strippen vervallen aan het einde van de cyclus.** Zet dat letterlijk in de productbeschrijving (Task 2, stap 4) — dat is juridisch de plek waar het moet staan, de ouder koopt het daar. Spoor 2 (mocht je die later alsnog bouwen) gaat hier al van uit: één rij per kind per cyclus, geen overdracht van restanten.

### B4 — Hoe wordt het afstrepen bijgehouden? ✅ bevestigd: optie 1, om te beginnen

**Gekozen: optie 1 — de trainer houdt zelf een lijst bij, geen software.** Precies het scenario waarvoor Spoor 0 nul code kost: doe Spoor 0 (en desgewenst Spoor 1), en laat Spoor 2 voorlopig liggen.

| Optie | Effort | Voor | Tegen |
|---|---|---|---|
| **1 — Niets in software; trainer houdt een lijst** ✅ gekozen | ~0 | Nul risico, nul code | Geen koppeling met de order; "ik heb nog twee strippen" is niet te beslechten |
| 2 — Tabblad `Strippen` in het bestaande werkboek | ~2-3 uur | Past exact op de bestaande architectuur (Sheets ís al de administratie); hergebruikt `haalOrderRegels()` zonder één extra WooCommerce-aanroep; trainer werkt in een sheet die hij al kent | Handmatig aanvinken blijft handmatig; de sheet moet de trainer gedeeld worden (let op de GCP-testgebruikerskwestie) |
| 3 — Bestaande WooCommerce-strippenkaartplugin | ~1 uur installeren, onbekende staart | Ouder ziet zijn saldo in Mijn Account; inschrijven per training mogelijk | Derde plugin op een checkout die al FunnelKit + twee eigen plugins draagt; licentiekosten; geen staging genoemd; conflictrisico met het fysio-vinkje |
| 4 — Eigen order-meta `_grovia_strippen_gebruikt` + adminkolom | ~4-6 uur | Precedent bestaat (`_grovia_ixly_taken` ADR-008, `_grovia_fysio_toestemming`); één bron van waarheid bij de order | Trainer moet in wp-admin werken; geen per-training-overzicht; nieuwe plugincode zonder pipeline |
| 5 — Volledige boekingsmodule (kind schrijft zich per training in) | dagen | Het "echte" antwoord op flexibiliteit | Buiten scope van deze vraag. Alleen noemen. |

**Spoor 2 (optie 2 hierboven) staat verderop in dit plan volledig uitgewerkt en getest (111 tests groen) — bewust niet weggehaald.** Loopt de handmatige lijst na de eerste cyclus tegen zijn grenzen aan ("wie heeft nog strippen over" wordt een discussie), dan is Spoor 2 een kant-en-klare volgende stap, geen nieuw project.

### B5 — Moet MiniMove-omzet in het Financieel-rapport?

Vandaag staat MiniMove nergens in het rapport (`VERENIGINGEN = ['KA','SU']`), en er is geen afdracht van € 20 per deelnemer aan MiniMove voor zover ik kan zien — MiniMove is Grovia's eigen product, geen vereniging. Als de omzet wél in beeld moet: Spoor 3. **Aanbeveling: nu niet doen** — de afdrachtlogica van het rapport (€ 20 per deelnemer per cyclus) klopt niet voor MiniMove en dat moet je dan eerst uitdenken. Zet MiniMove-omzet liever eerst in het Strippen-tabblad (Spoor 2 heeft de bedragen al bij de hand).

### B6 — Wat te doen met de losse bug die ik onderweg vond?

Zie Bijlage A: het Financieel-rapport gebruikt in **juni en juli** het verkeerde seizoen. Nu niet actief (augustus), sluimert tot juni 2027. Fix is vier regels. **Aanbeveling: meenemen in Spoor 4**, want je zit toch in dit bestand.

### B7 — Eenmalig inschrijfgeld (€ 20) ✅ bevestigd: buiten dit plan

**Gekozen: Berry stuurt zelf een Mollie-betaallink voor het inschrijfgeld, los van de webshop-checkout.** Geen actie nodig — dit raakt geen van de sporen hieronder, want het loopt helemaal buiten WooCommerce en dus buiten alles wat `haalOrders()`/`haalOrderRegels()` ziet.

Eén ding voor later, geen taak nu: **de technische bouwsteen hiervoor bestaat al.** De Azure Function `mollie-betaallink` ([ARCHITECTURE.md](../../ARCHITECTURE.md), regel 63) doet precies dit — een betaallink aanmaken en mailen — en wordt vandaag al gebruikt voor de C2/C3-instapkosten bij Kolping/Schagen. Wil je dit ooit automatiseren (bijv. een link die automatisch uitgaat bij de eerste MiniMove-aankoop van een kind), dan is dat een kwestie van diezelfde functie vanuit een nieuwe trigger aanroepen, geen nieuwe integratie bouwen. Niet nu doen — Berry's handmatige route werkt en dit voegt niets toe totdat het volume dat rechtvaardigt.

### B8 — Tenue bij eerste aanmelding ✅ herzien: bestaat al, kost één regel

**Correctie op mijn vorige antwoord.** Ik had voorgesteld hier een nieuwe plugin voor te bouwen (Spoor 5, hieronder doorgestreept). Jouw reactie — "deze zit al bij andere producten" — klopt, en ik heb het live nagekeken op grovia.nl in plaats van er nogmaals van uit te gaan.

**Wat er echt staat:** op zowel de MiniMove-productpagina als "Voetbaltraining – Kolping Academie" zit een ingebouwd maatuitvraag-mechanisme — drie velden (`tenue_maat_shirt`, `tenue_maat_broekje`, `tenue_maat_sokken`, optioneel, met de exacte maten die Jako hanteert: 92-152 + XS-XXL voor shirt/broek, 27-46 in schoenmaatbandjes voor sokken). Dat mechanisme wordt aangestuurd door een los, inline JavaScript-blok dat **niet in deze git-repo staat** — het leeft direct op de site, vermoedelijk in een Elementor-sjabloon voor productpagina's (theme builder → "Single Product"-template) of een code-snippet-plugin, want exact dezelfde velden en logica staan op twee totaal verschillende producten. Zie de nieuwe DOC-SIGNALS.md-melding hieronder voor waar dit precies vandaan komt.

**De kern van de logica** (uit het live script):

```javascript
function needsSizesFromValue(v){
    const val = String(v || '').toLowerCase();
    return val.includes('tenue') && !val.includes('zonder');
}
```

Dit veld verschijnt dus **alleen** als de gekozen `pa_inschrijving`-waarde de tekst "tenue" bevat én niet "zonder" — in de praktijk alleen bij `seizoenkaart-inclusief-tenue`. Voor `cyclus-1/2/3` en voor de nieuwe `strippenkaart-4/6/8-keer`-varianten bevat de slug geen "tenue", dus **het maatveld verschijnt niet automatisch** voor de strippenkaarten. Zonder ingreep krijgt niemand die een strippenkaart koopt de maatvraag te zien — functioneel gelijk aan "voorlopig handmatig", maar niet wat je vroeg.

**De simpele oplossing: één voorwaarde in dat bestaande script verbreden**, geen nieuwe plugin:

```javascript
function needsSizesFromValue(v){
    const val = String(v || '').toLowerCase();
    return (val.includes('tenue') && !val.includes('zonder')) || val.includes('strippenkaart');
}
```

Dat is de volledige wijziging. Geen nieuwe velden, geen nieuwe opslag, geen wijziging aan hoe de data ergens terechtkomt — alleen wanneer het al bestaande, al werkende blok zichtbaar wordt. Zie Spoor 5 (herzien) voor waar je dit zoekt en hoe je het test.

~~Spoor 5 zoals ik het eerder voorstelde (nieuwe plugin, vrij tekstveld) is niet meer nodig en hieronder vervangen.~~

---

## Deel 2 — Sporenoverzicht

| Spoor | Wat | Code? | Effort | Status |
|---|---|---|---|---|
| **0** | Productstructuur in WooCommerce | **Nul regels** | ~45 min | **Doe dit — morgen** |
| **1** | Fasecodes registreren (log-hygiëne + valkuil dichten) | 3 bestanden | ~30 min | Sterk aangeraden — morgen |
| **2** | `Strippen`-tabblad: strippenadministratie | 5 bestanden | ~2-3 uur | **Uitgesteld** — B4: begin met de handmatige lijst, dit staat klaar voor later |
| **3** | MiniMove in het Financieel-rapport | 2 bestanden | ~1 uur | Nu niet |
| **4** | Financieel-seizoensbug (Bijlage A) | 2 bestanden | ~20 min | Meenemen |
| **5** | Maatuitvraag tenue laten meewerken met de strippenkaarten | **Eén regel, buiten git** | ~5 min | Doe dit — anders krijgt niemand de maatvraag |

Sporen zijn onafhankelijk. Spoor 2 leunt op de slugs uit Spoor 0 en op de mapping uit Spoor 1. Spoor 5 leunt alleen op de categorie `minimove` uit Task 1 en staat verder los van alle andere sporen.

### Bestandsoverzicht

| Bestand | Spoor | Verantwoordelijkheid |
|---|---|---|
| WooCommerce-admin (geen bestand) | 0 | Varianten, prijzen, teksten |
| `plugins/grovia-automations/grovia-automations.php` | 1 | `$fase_map` — de slugs herkennen |
| Config-tabblad, kolommen O:P en R:T | 1, 2 | `mapping.strippen`, cyclus-kalender |
| `google-apps-script/deelnemers/Config.gs` | 1, 2 | Die twee blokken inlezen |
| `tests/gs/financieel.test.js` | 1 | Fixture + regressietest: de mapping verandert het rapport níet |
| `google-apps-script/deelnemers/Strippen.gs` | 2 | **Nieuw.** Pure strippenlogica, geen SpreadsheetApp |
| `tests/gs/strippen.test.js` | 2 | **Nieuw.** Tests voor die logica |
| `google-apps-script/deelnemers/Sheet.gs` | 2 | Kolomvolgorde + lezen/schrijven van het tabblad |
| `google-apps-script/deelnemers/Dagelijks.gs` | 2, 4 | Stap 6+7 met één gedeelde ophaalactie |
| `google-apps-script/deelnemers/Woo.gs` | 2 | `aantal` (quantity) meegeven per orderregel |
| `google-apps-script/deelnemers/Financieel.gs` | 4 | `bepaalFinancieelSeizoen()` + `seizoenEinddatum` exporteren |
| Live inline script (niet in git — zie DOC-SIGNALS.md) | 5 | Bestaand maatuitvraag-mechanisme; één voorwaarde verbreden |
| `docs/DECISIONS.md` | alle | ADR-012 |

---

# SPOOR 0 — Productstructuur in WooCommerce (verplicht, nul code)

### Task 1: MiniMove-producten inventariseren

Doe dit eerst en sla het niet over — de rest van dit plan gaat uit van aannames die je hier bevestigt of onderuit haalt.

> **Alvast bevestigd vanaf de live site (2026-08-05, tijdens het uitzoeken van de maatuitvraag hieronder):** het MiniMove-product (`product_id 1095`) is **al een variabel product** met `pa_inschrijving` als variatie-attribuut — B1/A1 klopt dus met hoe het product vandaag al werkt, dat hoeft niet vanaf nul opgezet. Bestaande waarden: `cyclus-1` t/m `cyclus-4` (elk € 105) en `seizoenkaart-inclusief-tenue` (€ 420) / `seizoenkaart-zonder-tenue` (€ 390). **Let op: vier cycli, niet drie** — dat wijkt af van de `CYCLI = ['C1','C2','C3']`-aanname in `Financieel.gs`, maar dat bestand sluit MiniMove toch al uit, dus geen effect. Vervang je de cyclus-terms door de drie strippenkaart-terms, besluit dan zelf of `cyclus-1..4` blijven bestaan naast de strippenkaarten of eruit gaan — dat stond nog nergens vastgelegd. Categorieën (`minimove`, `voetbaltraining`) heb ik **niet** betrouwbaar kunnen aflezen vanaf de voorkant; bevestig die zelf in wp-admin zoals stap 2 hieronder al zegt.

**Files:** geen (WooCommerce-admin, read-only)

- [ ] **Stap 1: Noteer de huidige staat van elk MiniMove-product**

Ga naar WooCommerce → Producten, filter op categorie **MiniMove**. Schrijf per product op:

| Vraag | Waarom het uitmaakt |
|---|---|
| Simpel of variabel product? | Bij simpel moet je hem eerst naar variabel omzetten voordat A1 kan |
| Heeft het `pa_inschrijving` als variatie-attribuut? | Zo niet, dan bestaat de aanname "MiniMove gebruikt dezelfde cyclusvarianten" niet en is A1 juist eenvoudiger |
| Welke categorieën hangen eraan? | `minimove` moet erop (schoolcode `MM`), en `voetbaltraining` voor de WhatsApp-tag `WA_MM_VT` |
| Staat `toestemming-vereist` erop? | Zou het fysio-vinkje aanzetten. Verwacht: **nee** |
| Huidige prijs | Het ankerpunt voor B2 |

- [ ] **Stap 2: Controleer of `minimove` en `voetbaltraining` beide op het hoofdproduct staan**

Dit is de enige harde eis uit de code. [grovia-automations.php:116](../../../plugins/grovia-automations/grovia-automations.php:116) leest de categorieën van het **hoofdproduct** (`get_parent_id()` bij een variatie), dus categorieën op de variatie zelf doen niets.

Zonder `minimove` → geen schoolcode → geen `WA_MM_VT` → **geen WhatsApp-uitnodiging meer.** Zonder `voetbaltraining` → geen typecode → idem. Dit is de enige manier waarop je hier een werkende flow kunt breken.

- [ ] **Stap 3: Leg de uitkomst vast in het plan zelf**

Schrijf de bevindingen als tabel onder deze taak in dit bestand en commit. Als de werkelijkheid afwijkt van B1's aanname, kies dan opnieuw uit B1 vóór je doorgaat.

```bash
git add docs/superpowers/plans/2026-08-05-minimove-strippenkaarten.md
git commit -m "docs: MiniMove-productinventarisatie vastgelegd in het strippenkaartplan"
```

### Task 2: De drie varianten aanmaken

**Files:** geen (WooCommerce-admin)

- [ ] **Stap 1: Zorg dat het MiniMove-product een variabel product is**

Product → tab **Algemeen** → Producttype op **Variabel product**. Was het simpel, dan verdwijnt het prijsveld op productniveau; de prijs zit vanaf nu per variatie.

- [ ] **Stap 2: Voeg de drie attribuutwaarden toe aan `pa_inschrijving`**

Producten → Attributen → **Inschrijving** (`pa_inschrijving`) → Waarden configureren. Voeg drie termen toe. **De slug is wat de code leest, niet de naam** — zet ze exact zo:

| Naam (zichtbaar voor de ouder) | Slug (leest de code) |
|---|---|
| Strippenkaart 4 keer | `strippenkaart-4-keer` |
| Strippenkaart 6 keer | `strippenkaart-6-keer` |
| Strippenkaart 8 keer | `strippenkaart-8-keer` |

Controleer de slug ná opslaan: WooCommerce genereert hem uit de naam en een afwijking (bijv. `strippenkaart-4keer`) breekt stilzwijgend de mapping in Spoor 1 en 2.

- [ ] **Stap 3: Hang het attribuut aan het product en zet "Gebruikt voor variaties" aan**

Product → tab **Attributen** → Inschrijving toevoegen → selecteer alléén de drie strippenkaartwaarden (niet cyclus-1/2/3 — die horen niet bij MiniMove) → vink **Gebruikt voor variaties** aan → Opslaan.

- [ ] **Stap 4: Maak de drie variaties met hun prijs**

Product → tab **Variaties** → de bevestigde prijzen uit B2:

| Variant | Prijs |
|---|---|
| `strippenkaart-4-keer` | € 50,00 |
| `strippenkaart-6-keer` | € 70,00 |
| `strippenkaart-8-keer` | € 85,00 |

Zet ook per variatie:
- **Beschrijving:** het aantal trainingen én de geldigheid ("geldig binnen de lopende cyclus van 8 trainingen; ongebruikte strippen vervallen aan het einde van de cyclus" — dit is de tekst waar B3 op landt, bevestigd: ja)
- **Voorraad:** ongelimiteerd, tenzij Grovia een maximum per cyclus wil

- [ ] **Stap 5: Werk de productbeschrijving bij**

Leg uit dat de cyclus 8 trainingen is en dat een kaart een deel daarvan afdekt. Dit is de enige plek waar de ouder de geldigheidsregel te zien krijgt vóór de aankoop; hij is niet in code te handhaven.

- [ ] **Stap 6: Testorder met een 100%-kortingscode**

Zelfde route als de fysio-toestemmingstest (staat al op de TODO). Maak een tijdelijke 100%-kortingscode, plaats één order per variant, en controleer daarna in de order:

| Te controleren | Verwacht |
|---|---|
| Regelmeta `pa_inschrijving` | exact `strippenkaart-4-keer` (etc.) — dit is de sleutel waar alles op leunt |
| WhatsApp-uitnodiging | **verstuurd** (de `WA_MM_VT`-tag hoort te zijn gezet) |
| Ixly/Action Type-mail | **niet verstuurd** |
| Fysio-toestemmingsvinkje op de checkout | **niet zichtbaar** |
| Deelnemers-tabblad na de volgende run | **geen nieuwe rij** |

Vind je `pa_inschrijving` niet terug in de order? Dan komt de meta onder een andere sleutel binnen en klopt de aanname uit [Woo.gs:90-96](../../../google-apps-script/deelnemers/Woo.gs:90) niet voor dit product. **Stop dan en herzie B1** voordat je Spoor 1 of 2 doet — die leunen er allebei op.

- [ ] **Stap 7: Ruim de testorders en de kortingscode op**

---

# SPOOR 1 — Fasecodes registreren (aangeraden)

**Waarom:** de log eerlijk maken (punt 1 in Deel 0) en de stille valkuil dichten die toeslaat zodra strippenkaarten ook voor KA/SU komen (punt 2). Verandert **niets** aan wat er functioneel gebeurt met MiniMove — dat bewijs je met een test.

### Task 3: De slugs opnemen in de drie mappings

De fase-mapping bestaat op **drie plekken die niets van elkaar weten**. Dat is bestaande schuld, geen keuze van dit plan; verander alle drie of geen.

**Files:**
- Modify: `plugins/grovia-automations/grovia-automations.php:85-91`
- Modify: Config-tabblad in het werkboek "Grovia Deelnemers", kolommen G:H
- Modify: `tests/gs/financieel.test.js:12-18`

**Interfaces:**
- Consumes: de slugs uit Task 2, stap 2
- Produces: `mapping.fases` kent `strippenkaart-4-keer` → `SK4`, `-6-keer` → `SK6`, `-8-keer` → `SK8`. `bepaalInschrijvingType()` blijft `''` teruggeven voor die codes — dat is opzet, niet een vergissing.

- [ ] **Stap 1: Schrijf de falende regressietest**

Deze test legt vast wat we juist **niet** willen laten veranderen. Voeg toe aan `tests/gs/financieel.test.js`, direct ná de bestaande `bepaalInschrijvingType`-test:

```javascript
test('een strippenkaart-fasecode telt bewust NIET mee in het Financieel-rapport', () => {
  // De slugs staan in mapping.fases zodat de PHP-tagcode ze herkent en de debug-log
  // de echte reden noemt ("MiniMove doet niet mee") in plaats van "fase niet gevonden".
  // Ze zijn expliciet GEEN cyclus en GEEN seizoenkaart: bepaalInschrijvingType laat
  // alleen C1/C2/C3/SMT/SZT door, dus het rapport blijft onveranderd. Verandert dat,
  // dan verschijnt MiniMove-omzet ongevraagd in de afdrachtberekening.
  assert.strictEqual(bepaalInschrijvingType('strippenkaart-4-keer', FASES), '');
  assert.strictEqual(bepaalInschrijvingType('strippenkaart-6-keer', FASES), '');
  assert.strictEqual(bepaalInschrijvingType('strippenkaart-8-keer', FASES), '');

  const rijen = berekenFinancieel(
    [regel({ categorieen: ['minimove', 'voetbaltraining'], inschrijving: 'strippenkaart-8-keer' })],
    MAPPING, '2627'
  );
  const totaal = rijen.reduce(function (som, r) {
    return som + r.spelers_cyclusproduct + r.spelers_seizoenkaart + r.inkomsten_incl_btw;
  }, 0);
  assert.strictEqual(totaal, 0);
});
```

- [ ] **Stap 2: Draai de test — hij moet falen**

Run: `node --test tests/gs/financieel.test.js`
Verwacht: FAIL. De eerste drie asserts slagen al (onbekende slug → `''`), maar dat is toeval; de test faalt zodra je de fixture in stap 3 uitbreidt. Draai hem hier vooral om te zien dat de suite groen ís vóór je begint.

- [ ] **Stap 3: Breid de test-fixture uit met de drie slugs**

In `tests/gs/financieel.test.js`, het `FASES`-object:

```javascript
const FASES = {
  'cyclus-1': 'C1',
  'cyclus-2': 'C2',
  'cyclus-3': 'C3',
  'seizoenkaart-inclusief-tenue': 'SMT',
  'seizoenkaart-zonder-tenue': 'SZT',
  // MiniMove-strippenkaarten. Staan hier zodat de fixture de Config-tabbladinhoud
  // blijft spiegelen; bepaalInschrijvingType laat ze bewust niet door.
  'strippenkaart-4-keer': 'SK4',
  'strippenkaart-6-keer': 'SK6',
  'strippenkaart-8-keer': 'SK8'
};
```

- [ ] **Stap 4: Draai alle Apps Script-tests**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS, alle bestanden. Faalt er een andere test, dan leunt die op de aanname dat `mapping.fases` precies vijf entries heeft — repareer die test, niet de mapping.

- [ ] **Stap 5: Voeg de fasecodes toe in `$fase_map` in de PHP**

In `plugins/grovia-automations/grovia-automations.php`, het `$fase_map`-blok:

```php
    // Fasecode — gebaseerd op variatie-attribuut pa_inschrijving
    // Nieuwe fase toevoegen: 'attribuut-waarde' => 'XX',
    $fase_map = [
        'cyclus-1'                     => 'C1',
        'cyclus-2'                     => 'C2',
        'cyclus-3'                     => 'C3',
        'seizoenkaart-inclusief-tenue' => 'SMT',
        'seizoenkaart-zonder-tenue'    => 'SZT',
        // MiniMove-strippenkaarten. Staan hier NIET om een assessment te triggeren --
        // MiniMove valt hieronder alsnog af op de 'MM'-check. Ze staan hier zodat de
        // debug-log de échte reden noemt ("MiniMove doet niet mee") in plaats van
        // "school of fase niet gevonden", en zodat een strippenkaart die ooit onder
        // KA/SU verkocht wordt niet stil zonder assessment-uitnodiging blijft:
        // de fase-check hieronder komt vóór de MM-check, dus een onbekende slug
        // laat een KA/SU-kind zonder uitnodiging achter, met alleen een logregel.
        'strippenkaart-4-keer'         => 'SK4',
        'strippenkaart-6-keer'         => 'SK6',
        'strippenkaart-8-keer'         => 'SK8',
    ];
```

**Let op de consequentie.** Vanaf nu krijgt een strippenkaart die onder **KA of SU** verkocht wordt wél een assessment-tag (`KASK42627_…`) en dus een Ixly-uitnodiging. Voor MiniMove verandert niets (de `MM`-check pakt hem alsnog). Wil je strippenkaarten voor KA/SU expliciet buiten het assessment houden, hang er dan een categorie aan die in `$uitsluit_categorieen` staat — dat is de bestaande, bedoelde uitschakelaar. De codes `SK4/SK6/SK8` botsen niet met `GROVIA_BETAALLINK_FASES` (`['C2','C3']`), dus er gaat nooit een Mollie-betaallink uit.

- [ ] **Stap 6: Vul de Config-mapping in het werkboek**

Werkboek "Grovia Deelnemers" → tabblad **Config** → kolommen **G:H** (`mapping.fases`), onder de bestaande vijf regels:

| G | H |
|---|---|
| `strippenkaart-4-keer` | `SK4` |
| `strippenkaart-6-keer` | `SK6` |
| `strippenkaart-8-keer` | `SK8` |

Het bereik is `G2:H30` ([Config.gs:43](../../../google-apps-script/deelnemers/Config.gs:43)) — ruim genoeg. Zet de cellen op tekstformaat als je twijfelt; `SK4` is geen getal, dus hier bijt CONVENTIONS-regel 3 niet, maar gewoonte is goedkoop.

- [ ] **Stap 7: Commit**

```bash
git add tests/gs/financieel.test.js plugins/grovia-automations/grovia-automations.php
git commit -m "feat: strippenkaart-fasecodes SK4/SK6/SK8 registreren voor eerlijke logs"
```

- [ ] **Stap 8: Upload de plugin naar WordPress**

**Geen pipeline** — dit gaat handmatig. Verhoog eerst de `Version:` in de plugin-header (nu `1.6` → `1.7`) zodat je in wp-admin kunt zien of de upload gelukt is. Upload, en plaats daarna één testorder om te bevestigen dat de log nu `OVERGESLAGEN: MiniMove doet niet mee aan Ixly/Action Type-assessment` zegt in plaats van `school of fase niet gevonden`.

---

# SPOOR 2 — Het `Strippen`-tabblad (aangeraden, mag later)

**Wat het doet:** één rij per kind per cyclus met de gekochte strippen bij elkaar opgeteld, acht kolommen om de aanwezigheid per training af te strepen, en een teller voor gebruikt/over. Het script vult **alleen** de gekochte strippen bij; het aanvinken is en blijft handwerk van de trainer.

**De centrale ontwerpeis:** dit tabblad bevat handmatig ingevoerde data. Het mag dus **nooit** volledig herschreven worden zoals `schrijfFinancieel` doet — het moet een upsert zijn zoals `upsertDeelnemers`. Beide patronen staan in dit codebase; hier is alleen het tweede goed.

### Task 4: `quantity` meegeven per orderregel

Twee dezelfde kaarten in één orderregel zijn twee kaarten. `haalOrderRegels()` geeft nu alleen `bedrag` terug (dat is `item.total`, inclusief quantity), niet het aantal — dus zonder deze stap telt een order van 2× een 4-kaart als 4 strippen in plaats van 8.

**Files:**
- Modify: `google-apps-script/deelnemers/Woo.gs:98-105`

**Interfaces:**
- Produces: elke orderregel uit `haalOrderRegels()` heeft een veld `aantal` (number, minimaal 1).

- [ ] **Stap 1: Voeg `aantal` toe aan het teruggegeven object**

In `haalOrderRegels()`, het `regels.push({...})`-blok:

```javascript
        regels.push({
          order_id:     String(order.id),
          datum:        datum,
          naam_kind:    naam_kind,
          categorieen:  categorieen,
          inschrijving: inschrijvingVeld ? String(inschrijvingVeld.value).trim() : '',
          bedrag:       Number(item.total) || 0,
          // Aantal stuks van deze regel. berekenFinancieel() gebruikt dit NIET (dat
          // rekent op item.total, waar de quantity al in verwerkt zit, en dedupliceert
          // kinderen op slug); upsertStrippen() heeft het wel nodig, want twee kaarten
          // in één regel zijn twee kaarten. Default 1: een orderregel zonder quantity
          // bestaat niet, maar 0 zou hier stil alle strippen wegvagen.
          aantal:       Number(item.quantity) || 1
        });
```

- [ ] **Stap 2: Draai de bestaande tests — niets mag breken**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS. `berekenFinancieel` leest `aantal` niet, dus een extra veld is inert.

- [ ] **Stap 3: Commit**

```bash
git add google-apps-script/deelnemers/Woo.gs
git commit -m "feat: aantal (quantity) per orderregel meegeven vanuit haalOrderRegels"
```

### Task 5: `seizoenEinddatum` deelbaar maken

`Strippen.gs` heeft dezelfde seizoensgrenzen nodig als `Financieel.gs`. In Apps Script delen alle bestanden één globale scope, maar de `node --test`-suite importeert per bestand — dus de functie moet geëxporteerd worden. Meteen de underscore eraf: hij is niet langer privé.

**Files:**
- Modify: `google-apps-script/deelnemers/Financieel.gs:59-61, 82, 174-179`

**Interfaces:**
- Produces: `seizoenEinddatum(seizoen)` → `'YYYY-MM-DD'`, geëxporteerd naast `seizoenStartdatum`.

- [ ] **Stap 1: Schrijf de falende test**

Voeg toe aan `tests/gs/financieel.test.js`, en breid de require-regel bovenaan uit met `seizoenEinddatum`:

```javascript
test('seizoenEinddatum geeft 1 juni van het eindjaar (exclusieve bovengrens)', () => {
  assert.strictEqual(seizoenEinddatum('2627'), '2027-06-01');
  assert.strictEqual(seizoenEinddatum('2526'), '2026-06-01');
});
```

- [ ] **Stap 2: Draai de test — hij moet falen**

Run: `node --test tests/gs/financieel.test.js`
Verwacht: FAIL met `seizoenEinddatum is not a function`.

- [ ] **Stap 3: Rename en exporteer**

Drie plekken in `Financieel.gs`. Eerst de definitie:

```javascript
/**
 * @param {string} seizoen bijv. '2627'
 * @return {string} 'YYYY-MM-DD', 1 juni van het eindjaar (= start van het VOLGENDE
 *   seizoen) -- de bovengrens (exclusief) van dit seizoen.
 *
 * Zonder underscore omdat Strippen.gs hem ook gebruikt: die moet exact dezelfde
 * seizoensgrens aanhouden als dit rapport, zodat er geen derde seizoensbegrip
 * ontstaat naast de 1-juni- en 1-augustusgrens (zie GLOSSARY).
 */
function seizoenEinddatum(seizoen) {
  return '20' + String(seizoen).slice(2, 4) + '-06-01';
}
```

Dan de aanroep in `berekenFinancieel` (was regel 82):

```javascript
  const seizoenTot = seizoenEinddatum(seizoen);
```

Dan het export-blok onderaan:

```javascript
if (typeof module !== 'undefined') {
  module.exports = {
    bepaalInschrijvingType: bepaalInschrijvingType,
    seizoenStartdatum: seizoenStartdatum,
    seizoenEinddatum: seizoenEinddatum,
    berekenFinancieel: berekenFinancieel
  };
}
```

- [ ] **Stap 4: Draai alle tests**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS. Grep daarna op de oude naam om zeker te zijn dat er geen aanroep is blijven staan:

```bash
grep -rn "_seizoenEinddatum" google-apps-script/ tests/
```

Verwacht: geen resultaten.

- [ ] **Stap 5: Commit**

```bash
git add google-apps-script/deelnemers/Financieel.gs tests/gs/financieel.test.js
git commit -m "refactor: seizoenEinddatum exporteren voor hergebruik door Strippen.gs"
```

### Task 6: `Strippen.gs` — de pure logica

**Files:**
- Create: `google-apps-script/deelnemers/Strippen.gs`
- Create: `tests/gs/strippen.test.js`

**Interfaces:**
- Consumes: `naarSlug()` (Deelnemers.gs), `seizoenStartdatum()` / `seizoenEinddatum()` (Financieel.gs), orderregels uit `haalOrderRegels()` inclusief `aantal` (Task 4), `mapping.strippen` en `cyclus_kalender` (Task 8).
- Produces:
  - `STRIPPEN_PER_CYCLUS` = `8`
  - `bepaalStrippen(slug, strippenMapping)` → `number` (0 als het geen strippenkaart is)
  - `bepaalCyclus(datum, kalender)` → `string` (`''` als de datum in geen cyclus valt)
  - `isAanwezig(celwaarde)` → `boolean`
  - `upsertStrippen(bestaandeRijen, regels, mapping, kalender, seizoen)` → `{rijen, nieuweKaarten}`
  - Rijvorm: `{seizoen, cyclus, naam_slug, naam_kind, vereniging, order_ids: string[], gekocht: number, sessies: boolean[8], gebruikt: number, over: number, laatste_order_op: string, opmerking: string}`

- [ ] **Stap 1: Schrijf de falende tests**

Create `tests/gs/strippen.test.js`:

```javascript
/**
 * Tests voor de pure strippenkaartlogica.
 * Gebruik: node --test tests/gs/
 */
const test = require('node:test');
const assert = require('node:assert');

const { naarSlug } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
const { seizoenStartdatum, seizoenEinddatum } =
  require('../../google-apps-script/deelnemers/Financieel.gs');

// Apps Script deelt één globale scope tussen alle .gs-bestanden; onder node moeten
// de functies uit andere bestanden expliciet global gemaakt worden. Zelfde patroon
// als financieel.test.js met naarSlug.
global.naarSlug = naarSlug;
global.seizoenStartdatum = seizoenStartdatum;
global.seizoenEinddatum = seizoenEinddatum;

const { STRIPPEN_PER_CYCLUS, bepaalStrippen, bepaalCyclus, isAanwezig, upsertStrippen } =
  require('../../google-apps-script/deelnemers/Strippen.gs');

const STRIPPEN = {
  'strippenkaart-4-keer': '4',
  'strippenkaart-6-keer': '6',
  'strippenkaart-8-keer': '8'
};

const MAPPING = {
  scholen: { 'kolping-academie': 'KA', 'schagen-united': 'SU', 'minimove': 'MM' },
  rollen: { 'voetbaltraining': 'Speler', 'keeperstraining': 'Keeper' },
  fases: {},
  uitgesloten: ['evenement', 'proef-training'],
  strippen: STRIPPEN
};

const KALENDER = [
  { code: 'C1', van: '2026-08-01', tot: '2026-11-01' },
  { code: 'C2', van: '2026-11-01', tot: '2027-02-01' },
  { code: 'C3', van: '2027-02-01', tot: '2027-06-01' }
];

function regel(overschrijf) {
  return Object.assign({
    order_id: '2000',
    datum: '2026-09-15',
    naam_kind: 'Sem de Vries',
    categorieen: ['minimove', 'voetbaltraining'],
    inschrijving: 'strippenkaart-4-keer',
    bedrag: 88,
    aantal: 1
  }, overschrijf);
}

function legeSessies() {
  return new Array(STRIPPEN_PER_CYCLUS).fill(false);
}

function bestaandeRij(overschrijf) {
  return Object.assign({
    seizoen: '2627',
    cyclus: 'C1',
    naam_slug: 'sem-de-vries',
    naam_kind: 'Sem de Vries',
    vereniging: 'MM',
    order_ids: ['2000'],
    gekocht: 4,
    sessies: legeSessies(),
    laatste_order_op: '2026-09-15',
    opmerking: ''
  }, overschrijf);
}

test('de cyclus is 8 trainingen', () => {
  assert.strictEqual(STRIPPEN_PER_CYCLUS, 8);
});

test('bepaalStrippen leest het aantal uit mapping.strippen', () => {
  assert.strictEqual(bepaalStrippen('strippenkaart-4-keer', STRIPPEN), 4);
  assert.strictEqual(bepaalStrippen('strippenkaart-6-keer', STRIPPEN), 6);
  assert.strictEqual(bepaalStrippen('strippenkaart-8-keer', STRIPPEN), 8);
});

test('bepaalStrippen geeft 0 voor niet-strippenkaarten', () => {
  assert.strictEqual(bepaalStrippen('cyclus-1', STRIPPEN), 0);
  assert.strictEqual(bepaalStrippen('', STRIPPEN), 0);
  assert.strictEqual(bepaalStrippen(undefined, STRIPPEN), 0);
});

test('bepaalCyclus wijst een datum toe aan de juiste cyclus', () => {
  assert.strictEqual(bepaalCyclus('2026-09-15', KALENDER), 'C1');
  assert.strictEqual(bepaalCyclus('2026-12-01', KALENDER), 'C2');
  assert.strictEqual(bepaalCyclus('2027-03-01', KALENDER), 'C3');
});

test('bepaalCyclus: van is inclusief, tot is exclusief', () => {
  assert.strictEqual(bepaalCyclus('2026-08-01', KALENDER), 'C1');
  assert.strictEqual(bepaalCyclus('2026-10-31', KALENDER), 'C1');
  assert.strictEqual(bepaalCyclus('2026-11-01', KALENDER), 'C2');
});

test('bepaalCyclus geeft leeg buiten elke cyclus en bij een lege kalender', () => {
  assert.strictEqual(bepaalCyclus('2026-07-15', KALENDER), '');
  assert.strictEqual(bepaalCyclus('2026-09-15', []), '');
});

test('isAanwezig: een uitgevinkte checkbox is NIET aanwezig', () => {
  // De valkuil: String(false) is 'false', een niet-lege tekst. Zonder expliciete
  // booleancheck zou elke uitgevinkte checkbox als aanwezig gelden.
  assert.strictEqual(isAanwezig(false), false);
  assert.strictEqual(isAanwezig(true), true);
});

test('isAanwezig: leeg is niet aanwezig, elke andere tekst wel', () => {
  assert.strictEqual(isAanwezig(''), false);
  assert.strictEqual(isAanwezig('   '), false);
  assert.strictEqual(isAanwezig(null), false);
  assert.strictEqual(isAanwezig(undefined), false);
  assert.strictEqual(isAanwezig('x'), true);
  assert.strictEqual(isAanwezig('X'), true);
  assert.strictEqual(isAanwezig('aanwezig'), true);
});

test('een nieuwe strippenkaart wordt een nieuwe rij met lege sessies', () => {
  const { rijen, nieuweKaarten } = upsertStrippen([], [regel()], MAPPING, KALENDER, '2627');
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(nieuweKaarten, 1);
  assert.strictEqual(rijen[0].naam_slug, 'sem-de-vries');
  assert.strictEqual(rijen[0].cyclus, 'C1');
  assert.strictEqual(rijen[0].vereniging, 'MM');
  assert.strictEqual(rijen[0].gekocht, 4);
  assert.strictEqual(rijen[0].gebruikt, 0);
  assert.strictEqual(rijen[0].over, 4);
  assert.deepStrictEqual(rijen[0].order_ids, ['2000']);
  assert.strictEqual(rijen[0].sessies.length, STRIPPEN_PER_CYCLUS);
});

test('quantity 2 op één regel levert twee kaarten aan strippen op', () => {
  const { rijen } = upsertStrippen([], [regel({ aantal: 2 })], MAPPING, KALENDER, '2627');
  assert.strictEqual(rijen[0].gekocht, 8);
});

test('een tweede kaart in dezelfde cyclus telt bij dezelfde rij op', () => {
  const { rijen } = upsertStrippen(
    [],
    [regel({ order_id: '2000' }), regel({ order_id: '2100', datum: '2026-10-01' })],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].gekocht, 8);
  assert.deepStrictEqual(rijen[0].order_ids, ['2000', '2100']);
  assert.strictEqual(rijen[0].laatste_order_op, '2026-10-01');
});

test('twee verschillende kaarten in ÉÉN order tellen beide mee', () => {
  // Eén order kan twee strippenkaartregels voor hetzelfde kind bevatten. Zonder de
  // voorbewerking per (order, kind, cyclus) zou de order_ids-dedup de tweede regel
  // laten vallen en zou de helft van de strippen verdwijnen.
  const { rijen } = upsertStrippen(
    [],
    [
      regel({ order_id: '2000', inschrijving: 'strippenkaart-4-keer' }),
      regel({ order_id: '2000', inschrijving: 'strippenkaart-6-keer' })
    ],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].gekocht, 10);
  assert.deepStrictEqual(rijen[0].order_ids, ['2000']);
});

test('dezelfde order twee keer verwerken telt niet dubbel (idempotent)', () => {
  const eerste = upsertStrippen([], [regel()], MAPPING, KALENDER, '2627');
  const tweede = upsertStrippen(eerste.rijen, [regel()], MAPPING, KALENDER, '2627');
  assert.strictEqual(tweede.rijen.length, 1);
  assert.strictEqual(tweede.rijen[0].gekocht, 4);
  assert.strictEqual(tweede.nieuweKaarten, 0);
});

test('aangevinkte sessies blijven staan bij een nieuwe order', () => {
  // Dit is de kernwaarborg van het hele tabblad: de trainer vinkt handmatig af en
  // een dagelijkse run mag dat nooit wegvagen.
  const sessies = legeSessies();
  sessies[0] = true;
  sessies[1] = true;

  const { rijen } = upsertStrippen(
    [bestaandeRij({ sessies: sessies })],
    [regel({ order_id: '2100', datum: '2026-10-01' })],
    MAPPING, KALENDER, '2627'
  );

  assert.strictEqual(rijen[0].sessies[0], true);
  assert.strictEqual(rijen[0].sessies[1], true);
  assert.strictEqual(rijen[0].sessies[2], false);
  assert.strictEqual(rijen[0].gekocht, 8);
  assert.strictEqual(rijen[0].gebruikt, 2);
  assert.strictEqual(rijen[0].over, 6);
});

test('een rij zonder nieuwe orders blijft ongemoeid bestaan', () => {
  const sessies = legeSessies();
  sessies[0] = true;
  const { rijen, nieuweKaarten } =
    upsertStrippen([bestaandeRij({ sessies: sessies })], [], MAPPING, KALENDER, '2627');
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(nieuweKaarten, 0);
  assert.strictEqual(rijen[0].gebruikt, 1);
  assert.strictEqual(rijen[0].over, 3);
});

test('over wordt negatief als er meer sessies zijn afgestreept dan gekocht', () => {
  // Bewust niet afgekapt op 0: een negatieve waarde is precies het signaal dat de
  // trainer nodig heeft ("dit kind heeft meer getraind dan betaald").
  const sessies = legeSessies();
  for (let i = 0; i < 6; i += 1) {
    sessies[i] = true;
  }
  const { rijen } = upsertStrippen([bestaandeRij({ sessies: sessies })], [], MAPPING, KALENDER, '2627');
  assert.strictEqual(rijen[0].gebruikt, 6);
  assert.strictEqual(rijen[0].over, -2);
});

test('twee cycli voor hetzelfde kind zijn twee rijen', () => {
  const { rijen } = upsertStrippen(
    [],
    [regel({ order_id: '2000', datum: '2026-09-15' }), regel({ order_id: '2100', datum: '2026-12-01' })],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 2);
  assert.deepStrictEqual(rijen.map(function (r) { return r.cyclus; }).sort(), ['C1', 'C2']);
});

test('een cyclusproduct of seizoenkaart levert geen strippenrij op', () => {
  const { rijen } = upsertStrippen(
    [],
    [regel({ inschrijving: 'cyclus-1' }), regel({ order_id: '2100', inschrijving: 'seizoenkaart-zonder-tenue' })],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 0);
});

test('een uitgesloten categorie levert geen strippenrij op', () => {
  const { rijen } = upsertStrippen(
    [],
    [regel({ categorieen: ['minimove', 'voetbaltraining', 'evenement'] })],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 0);
});

test('een regel zonder naam kind levert geen rij op', () => {
  const { rijen } = upsertStrippen([], [regel({ naam_kind: '' })], MAPPING, KALENDER, '2627');
  assert.strictEqual(rijen.length, 0);
});

test('orders buiten het seizoensvenster tellen niet mee', () => {
  // Zelfde 1-junigrens als het Financieel-rapport: 2627 loopt van 2026-06-01 tot
  // 2027-06-01. Geen derde seizoensbegrip.
  const voor = upsertStrippen([], [regel({ datum: '2026-05-31' })], MAPPING, KALENDER, '2627');
  const na = upsertStrippen([], [regel({ datum: '2027-06-01' })], MAPPING, KALENDER, '2627');
  assert.strictEqual(voor.rijen.length, 0);
  assert.strictEqual(na.rijen.length, 0);
});

test('een strippenkaart onder KA/SU werkt ook (niet MiniMove-only vastgezet)', () => {
  const { rijen } = upsertStrippen(
    [],
    [regel({ categorieen: ['kolping-academie', 'voetbaltraining'] })],
    MAPPING, KALENDER, '2627'
  );
  assert.strictEqual(rijen.length, 1);
  assert.strictEqual(rijen[0].vereniging, 'KA');
});

test('upsertStrippen muteert de meegegeven rijen niet', () => {
  const origineel = bestaandeRij();
  upsertStrippen([origineel], [regel({ order_id: '2100' })], MAPPING, KALENDER, '2627');
  assert.deepStrictEqual(origineel.order_ids, ['2000']);
  assert.strictEqual(origineel.gekocht, 4);
});
```

- [ ] **Stap 2: Draai de tests — ze moeten falen**

Run: `node --test tests/gs/strippen.test.js`
Verwacht: FAIL — `Cannot find module '.../Strippen.gs'`.

- [ ] **Stap 3: Schrijf `Strippen.gs`**

Create `google-apps-script/deelnemers/Strippen.gs`:

```javascript
/**
 * Pure logica voor het Strippen-tabblad: de strippenkaartadministratie.
 *
 * Een strippenkaart geeft recht op een aantal trainingen (4, 6 of 8) binnen één
 * cyclus van STRIPPEN_PER_CYCLUS trainingen. De AANWEZIGHEID per training wordt
 * handmatig door de trainer aangevinkt in het tabblad; dit script vult alleen de
 * gekochte strippen bij en rekent gebruikt/over uit.
 *
 * Daarom is dit een UPSERT (zoals upsertDeelnemers) en geen volledige herschrijving
 * (zoals schrijfFinancieel): het tabblad bevat handmatig ingevoerde data die een
 * dagelijkse run nooit mag wegvagen. Beide patronen bestaan in dit codebase --
 * hier is alleen het eerste goed.
 *
 * Eén rij per kind per cyclus, niet per order: een ouder die twee losse kaarten
 * koopt hoort in één rij met de strippen opgeteld. order_ids houdt bij welke orders
 * al meegeteld zijn, zodat een tweede run niets dubbel telt.
 *
 * Seizoensgrens is BEWUST die van Financieel.gs (1 juni), niet bepaalSeizoen()'s
 * 1 augustus: de orderregels komen uit dezelfde haalOrderRegels()-aanroep als het
 * Financieel-rapport, en strippenkaartverkoop start net als cyclusverkoop al in
 * juni/juli. Er komt hier dus GEEN derde seizoensbegrip bij (zie GLOSSARY).
 *
 * Dit bestand raakt bewust geen SpreadsheetApp of UrlFetchApp aan, zodat de logica
 * met `node --test tests/gs/` te testen is. Sheet-toegang zit in Sheet.gs.
 */

// Aantal trainingen in één cyclus. Bepaalt hoeveel sessiekolommen het tabblad heeft;
// STRIPPEN_KOLOMMEN in Sheet.gs moet hier precies zoveel T-kolommen tegenover zetten.
const STRIPPEN_PER_CYCLUS = 8;

/**
 * @param {string} inschrijvingSlug ruwe waarde uit de 'pa_inschrijving'-regelmeta
 * @param {Object} strippenMapping mapping.strippen uit het Config-tabblad (slug -> aantal)
 * @return {number} aantal strippen, of 0 als deze slug geen strippenkaart is
 */
function bepaalStrippen(inschrijvingSlug, strippenMapping) {
  const aantal = Number((strippenMapping || {})[String(inschrijvingSlug || '').trim()]);
  return aantal > 0 ? aantal : 0;
}

/**
 * @param {string} datum 'YYYY-MM-DD'
 * @param {{code: string, van: string, tot: string}[]} kalender config.cyclus_kalender
 * @return {string} cycluscode, of '' als de datum in geen enkele cyclus valt
 */
function bepaalCyclus(datum, kalender) {
  const dag = String(datum || '');
  const gevonden = (kalender || []).filter(function (cyclus) {
    return dag >= cyclus.van && dag < cyclus.tot;
  })[0];
  return gevonden ? gevonden.code : '';
}

/**
 * Leest één sessiecel als 'wel/niet aanwezig'.
 *
 * Handelt drie invoervormen af, want de trainer werkt in de sheet-UI: een checkbox
 * (echte boolean), een kruisje of woord (tekst), en een lege cel. Let op de valkuil:
 * een UITGEVINKTE checkbox komt terug als boolean false, en String(false) is 'false'
 * -- een niet-lege tekst. Zonder de expliciete booleancheck hieronder zou elke
 * uitgevinkte checkbox dus als aanwezig gelden.
 *
 * @param {*} waarde de celwaarde
 * @return {boolean}
 */
function isAanwezig(waarde) {
  if (waarde === true || waarde === false) {
    return waarde;
  }
  return String(waarde === null || waarde === undefined ? '' : waarde).trim() !== '';
}

/**
 * Voegt gekochte strippenkaarten samen met de bestaande rijen.
 *
 * @param {Object[]} bestaandeRijen rijen zoals gelezen uit het Strippen-tabblad
 * @param {Object[]} regels orderregels uit haalOrderRegels() (inclusief `aantal`)
 * @param {Object} mapping {scholen, uitgesloten, strippen} uit het Config-tabblad
 * @param {{code, van, tot}[]} kalender config.cyclus_kalender
 * @param {string} seizoen bijv. '2627' -- regels buiten dit seizoen tellen niet mee
 * @return {{rijen: Object[], nieuweKaarten: number}}
 */
function upsertStrippen(bestaandeRijen, regels, mapping, kalender, seizoen) {
  const seizoenVan = seizoenStartdatum(seizoen);
  const seizoenTot = seizoenEinddatum(seizoen);

  const rijen = bestaandeRijen.map(function (rij) {
    return Object.assign({}, rij, {
      order_ids: rij.order_ids.slice(),
      sessies:   rij.sessies.slice()
    });
  });

  const index = {};
  rijen.forEach(function (rij, i) {
    index[_sleutel(rij.seizoen, rij.cyclus, rij.naam_slug)] = i;
  });

  // Eerst per (order, kind, cyclus) optellen. Eén order kan twee strippenkaartregels
  // voor hetzelfde kind bevatten (bijv. een 4- en een 6-kaart); zonder deze
  // voorbewerking zou de order_ids-dedup hieronder de tweede regel laten vallen en
  // zou de helft van de strippen stil verdwijnen.
  const perOrder = {};
  const volgorde = [];

  regels.forEach(function (regel) {
    if (regel.datum < seizoenVan || regel.datum >= seizoenTot) {
      return;
    }

    const categorieen = regel.categorieen || [];
    if (categorieen.some(function (c) { return mapping.uitgesloten.indexOf(c) !== -1; })) {
      return;
    }

    const perKaart = bepaalStrippen(regel.inschrijving, mapping.strippen);
    if (!perKaart) {
      return;
    }

    const slug = naarSlug(regel.naam_kind);
    if (!slug) {
      return;
    }

    let vereniging = '';
    categorieen.forEach(function (c) {
      if (!vereniging && mapping.scholen[c]) {
        vereniging = mapping.scholen[c];
      }
    });

    const cyclus  = bepaalCyclus(regel.datum, kalender);
    const orderId = String(regel.order_id);
    const bundel  = _sleutel(seizoen, cyclus, slug) + '||' + orderId;

    if (!perOrder[bundel]) {
      perOrder[bundel] = {
        cyclus:     cyclus,
        slug:       slug,
        naam_kind:  regel.naam_kind,
        vereniging: vereniging,
        order_id:   orderId,
        datum:      regel.datum,
        strippen:   0
      };
      volgorde.push(bundel);
    }

    // Twee kaarten in één orderregel zijn twee kaarten, vandaar `aantal` (quantity).
    perOrder[bundel].strippen += perKaart * (Number(regel.aantal) || 1);
  });

  let nieuweKaarten = 0;

  volgorde.forEach(function (bundel) {
    const kaart   = perOrder[bundel];
    const sleutel = _sleutel(seizoen, kaart.cyclus, kaart.slug);

    if (index[sleutel] === undefined) {
      rijen.push({
        seizoen:          seizoen,
        cyclus:           kaart.cyclus,
        naam_slug:        kaart.slug,
        naam_kind:        kaart.naam_kind,
        vereniging:       kaart.vereniging,
        order_ids:        [kaart.order_id],
        gekocht:          kaart.strippen,
        sessies:          _legeSessies(),
        laatste_order_op: kaart.datum,
        opmerking:        ''
      });
      index[sleutel] = rijen.length - 1;
      nieuweKaarten += 1;
      return;
    }

    const rij = rijen[index[sleutel]];
    if (rij.order_ids.indexOf(kaart.order_id) !== -1) {
      return;   // deze order is al eerder opgeteld -- idempotent
    }

    rij.order_ids.push(kaart.order_id);
    rij.gekocht += kaart.strippen;
    if (kaart.datum > rij.laatste_order_op) {
      rij.laatste_order_op = kaart.datum;
    }
    nieuweKaarten += 1;
  });

  return { rijen: rijen.map(_metTellers), nieuweKaarten: nieuweKaarten };
}

function _sleutel(seizoen, cyclus, naamSlug) {
  return String(seizoen) + '|' + String(cyclus) + '|' + String(naamSlug);
}

function _legeSessies() {
  const sessies = [];
  for (let i = 0; i < STRIPPEN_PER_CYCLUS; i += 1) {
    sessies.push(false);
  }
  return sessies;
}

/**
 * Berekent gebruikt/over uit de sessies. Bewust berekend en niet als sheetformule:
 * schrijfStrippen() overschrijft het hele databereik, dus een formule in de cel zou
 * bij de eerste run verdwijnen. Eén schrijver, geen formules.
 *
 * `over` wordt NIET afgekapt op 0: een negatieve waarde is precies het signaal dat de
 * trainer nodig heeft -- dit kind heeft meer getraind dan het betaald heeft.
 */
function _metTellers(rij) {
  const gebruikt = rij.sessies.filter(Boolean).length;
  return Object.assign({}, rij, {
    gebruikt: gebruikt,
    over:     rij.gekocht - gebruikt
  });
}

// Alleen voor `node --test`; Apps Script kent `module` niet en slaat dit over.
if (typeof module !== 'undefined') {
  module.exports = {
    STRIPPEN_PER_CYCLUS: STRIPPEN_PER_CYCLUS,
    bepaalStrippen: bepaalStrippen,
    bepaalCyclus: bepaalCyclus,
    isAanwezig: isAanwezig,
    upsertStrippen: upsertStrippen
  };
}
```

- [ ] **Stap 4: Draai de tests tot ze groen zijn**

Run: `node --test tests/gs/strippen.test.js`
Verwacht: PASS, alle tests.

- [ ] **Stap 5: Draai de volledige suite**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS. Let op: `Strippen.gs` definieert globale consts die in Apps Script naast de andere bestanden leven — grep of `STRIPPEN_PER_CYCLUS`, `bepaalStrippen`, `bepaalCyclus` of `isAanwezig` nergens anders al bestaan:

```bash
grep -rn "STRIPPEN_PER_CYCLUS\|function bepaalStrippen\|function bepaalCyclus\|function isAanwezig" google-apps-script/
```

Verwacht: alleen treffers in `Strippen.gs`.

- [ ] **Stap 6: Commit**

```bash
git add google-apps-script/deelnemers/Strippen.gs tests/gs/strippen.test.js
git commit -m "feat: pure strippenkaartlogica met upsert die handmatige presentie bewaart"
```

### Task 7: Sheet-toegang voor het `Strippen`-tabblad

**Files:**
- Modify: `google-apps-script/deelnemers/Sheet.gs` (toevoegen ná `schrijfFinancieel`, rond regel 136)

**Interfaces:**
- Consumes: `isAanwezig()` en `STRIPPEN_PER_CYCLUS` uit `Strippen.gs`; `_tab()` en `_alsDatumTekst()` bestaan al in `Sheet.gs`.
- Produces: `leesStrippen()` → rijen in de vorm die `upsertStrippen()` verwacht; `schrijfStrippen(rijen)`.

- [ ] **Stap 1: Voeg de kolomdefinitie en de twee functies toe**

In `Sheet.gs`, direct ná `schrijfFinancieel`:

```javascript
// Kolomvolgorde van het Strippen-tabblad. Moet exact overeenkomen met het werkboek.
// Het aantal T-kolommen moet gelijk zijn aan STRIPPEN_PER_CYCLUS (Strippen.gs) --
// _controleerStrippenKolommen() hieronder faalt hard als dat uit elkaar loopt.
const STRIPPEN_KOLOMMEN = [
  'seizoen', 'cyclus', 'naam_slug', 'naam_kind', 'vereniging',
  'order_ids', 'gekocht',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8',
  'gebruikt', 'over', 'laatste_order_op', 'opmerking'
];

function _controleerStrippenKolommen() {
  const sessieKolommen = STRIPPEN_KOLOMMEN.filter(function (kolom) {
    return /^T\d+$/.test(kolom);
  }).length;
  if (sessieKolommen !== STRIPPEN_PER_CYCLUS) {
    throw new Error(
      'STRIPPEN_KOLOMMEN heeft ' + sessieKolommen + ' sessiekolommen maar ' +
      'STRIPPEN_PER_CYCLUS is ' + STRIPPEN_PER_CYCLUS + ' -- pas beide aan, ' +
      'én de kopregels in het Strippen-tabblad.'
    );
  }
}

/**
 * @return {Object[]} alle strippenrijen in de vorm die upsertStrippen() verwacht
 */
function leesStrippen() {
  _controleerStrippenKolommen();

  const tab = _tab('Strippen');
  const laatste = tab.getLastRow();
  if (laatste < 2) {
    return [];
  }

  return tab.getRange(2, 1, laatste - 1, STRIPPEN_KOLOMMEN.length).getValues().map(function (rij) {
    const cel = {};
    STRIPPEN_KOLOMMEN.forEach(function (kolom, i) {
      cel[kolom] = rij[i];
    });

    const sessies = [];
    for (let i = 1; i <= STRIPPEN_PER_CYCLUS; i += 1) {
      sessies.push(isAanwezig(cel['T' + i]));
    }

    // gebruikt en over worden NIET teruggelezen: upsertStrippen rekent ze elke run
    // opnieuw uit de sessies. Ze staan alleen in het tabblad om te lezen.
    return {
      seizoen:          String(cel.seizoen || ''),
      cyclus:           String(cel.cyclus || ''),
      naam_slug:        String(cel.naam_slug || ''),
      naam_kind:        String(cel.naam_kind || ''),
      vereniging:       String(cel.vereniging || ''),
      order_ids:        String(cel.order_ids || '').split(',').filter(String),
      gekocht:          Number(cel.gekocht) || 0,
      sessies:          sessies,
      laatste_order_op: _alsDatumTekst(cel.laatste_order_op),
      opmerking:        String(cel.opmerking || '')
    };
  });
}

/**
 * Schrijft alle strippenrijen in één keer weg. Overschrijft het hele databereik --
 * dat mag alleen omdat upsertStrippen() de aangevinkte sessies uit leesStrippen()
 * heeft meegenomen. Schrijf hier dus NOOIT zonder eerst te lezen en te upserten.
 *
 * @param {Object[]} rijen uit upsertStrippen()
 */
function schrijfStrippen(rijen) {
  _controleerStrippenKolommen();

  const tab = _tab('Strippen');

  if (tab.getLastRow() > 1) {
    tab.getRange(2, 1, tab.getLastRow() - 1, STRIPPEN_KOLOMMEN.length).clearContent();
  }
  if (!rijen.length) {
    return;
  }

  const waarden = rijen.map(function (rij) {
    return STRIPPEN_KOLOMMEN.map(function (kolom) {
      if (kolom === 'order_ids') {
        return rij.order_ids.join(',');
      }
      const sessie = kolom.match(/^T(\d+)$/);
      if (sessie) {
        return rij.sessies[Number(sessie[1]) - 1] ? 'x' : '';
      }
      return rij[kolom];
    });
  });

  // Tekstformaat op de order_ids-kolom VOORDAT er geschreven wordt -- CONVENTIONS-regel 3.
  // '2000,2100' wordt met een Nederlandse locale anders als getal gelezen en is dan al
  // kapot vóórdat leesStrippen() hem terugleest. Dit is exact de order_ids-bug die in het
  // Deelnemers-tabblad nog open staat; hier vanaf regel één goed gedaan.
  const orderKolom = STRIPPEN_KOLOMMEN.indexOf('order_ids') + 1;
  tab.getRange(2, orderKolom, waarden.length, 1).setNumberFormat('@');

  tab.getRange(2, 1, waarden.length, STRIPPEN_KOLOMMEN.length).setValues(waarden);
}
```

- [ ] **Stap 2: Draai de tests**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS. `leesStrippen`/`schrijfStrippen` raken `SpreadsheetApp` aan en worden — net als `leesDeelnemers` — niet in node getest; ze staan bewust niet in het `module.exports`-blok van `Sheet.gs`.

- [ ] **Stap 3: Commit**

```bash
git add google-apps-script/deelnemers/Sheet.gs
git commit -m "feat: lezen en schrijven van het Strippen-tabblad, met tekstformaat op order_ids"
```

### Task 8: Config uitbreiden met `mapping.strippen` en de cyclus-kalender

**Files:**
- Modify: `google-apps-script/deelnemers/Config.gs:41-50` en het helperblok onderaan
- Modify: Config-tabblad in het werkboek, kolommen **O:P** en **R:T**

**Interfaces:**
- Produces: `config.mapping.strippen` (`{slug: aantal-als-tekst}`) en `config.cyclus_kalender` (`{code, van, tot}[]`).

- [ ] **Stap 1: Lees de twee nieuwe blokken in**

In `leesConfig()`, het `mapping`-object en één nieuw veld ernaast:

```javascript
    mapping: {
      scholen:     _leesPaar(tab, 'D2:E30'),
      fases:       _leesPaar(tab, 'G2:H30'),
      uitgesloten: _leesKolom(tab, 'J2:J30'),
      // Categorie-slug -> 'Speler'/'Keeper', zelfde vorm als scholen hierboven.
      // Losse kolommen L:M, want fases (G:H) betekent hier iets anders
      // (trainingscyclus/seizoenkaarttype, niet speelpositie).
      rollen:      _leesPaar(tab, 'L2:M30'),
      // Slug van de strippenkaartvariatie -> aantal strippen
      // ('strippenkaart-4-keer' -> '4'). Losse kolommen O:P: dit is géén fase (G:H)
      // en géén rol (L:M) maar een aantal, en fases mag niet vervuild raken --
      // bepaalInschrijvingType() laat daar alleen C1/C2/C3/SMT/SZT door.
      strippen:    _leesPaar(tab, 'O2:P30')
    },
    // Cyclus-kalender voor de strippenadministratie: code | van | tot (tot exclusief).
    // Bepaalt in welke cyclus een strippenkaartorder valt (bepaalCyclus in Strippen.gs).
    // Leeg laten mag: dan krijgt elke rij cyclus '' en wordt het één rij per kind per
    // seizoen in plaats van per cyclus.
    cyclus_kalender: _leesDrieluik(tab, 'R2:T30')
```

- [ ] **Stap 2: Voeg de helper toe**

Onderaan `Config.gs`, naast `_leesPaar` en `_leesKolom`:

```javascript
/**
 * Leest een drie-kolomsblok als lijst objecten {code, van, tot}. Datumcellen gaan
 * door _alsDatum, want Google Sheets maakt van '2026-08-01' zelf een Date-cel en een
 * Date vergelijkt niet met de 'YYYY-MM-DD'-strings waarop bepaalCyclus() filtert.
 *
 * Rijen waarvan één van de drie cellen leeg is worden overgeslagen: een half
 * ingevulde kalenderregel zou een cyclus met een open grens opleveren en dan valt
 * elke order erin.
 */
function _leesDrieluik(tab, bereik) {
  return tab.getRange(bereik).getValues()
    .filter(function (rij) { return rij[0] && rij[1] && rij[2]; })
    .map(function (rij) {
      return {
        code: String(rij[0]).trim(),
        van:  _alsDatum(rij[1]),
        tot:  _alsDatum(rij[2])
      };
    });
}
```

- [ ] **Stap 3: Vul het Config-tabblad — kolommen O:P**

| O | P |
|---|---|
| `strippenkaart-4-keer` | `4` |
| `strippenkaart-6-keer` | `6` |
| `strippenkaart-8-keer` | `8` |

Zet ook kopteksten in **O1** ("strippenkaart-slug") en **P1** ("aantal strippen") — het bereik begint op rij 2.

- [ ] **Stap 4: Vul het Config-tabblad — kolommen R:T (cyclus-kalender)**

Kopteksten in R1/S1/T1 ("cyclus", "van", "tot"), en per cyclus één regel met de **echte** trainingsdata van MiniMove. `tot` is exclusief — de begindatum van de volgende cyclus. Vraag deze data bij Berry; de waarden hieronder zijn een voorbeeld en horen niet zo live te staan:

| R | S | T |
|---|---|---|
| `C1` | `2026-08-01` | `2026-11-01` |
| `C2` | `2026-11-01` | `2027-02-01` |
| `C3` | `2027-02-01` | `2027-06-01` |

Weet je de data nog niet? **Laat het blok leeg.** Dan wordt de cyclus `''` en krijg je één rij per kind per seizoen — nog steeds bruikbaar, en de kalender kun je later aanvullen. Let op: aanvullen ná de eerste run verandert de rijsleutel (`seizoen|cyclus|naam_slug`) en levert dan nieuwe rijen náást de oude op. Vul de kalender dus liefst vóór de eerste run, of ruim het tabblad handmatig op als je hem later invult.

- [ ] **Stap 5: Draai de tests**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS. `Config.gs` raakt `SpreadsheetApp` aan en wordt niet in node getest; deze stap bevestigt alleen dat er niets anders gebroken is.

- [ ] **Stap 6: Commit**

```bash
git add google-apps-script/deelnemers/Config.gs
git commit -m "feat: mapping.strippen en cyclus_kalender inlezen uit het Config-tabblad"
```

### Task 9: Stap 7 in de dagelijkse run

Nu de sporen samenkomen. **Belangrijk:** stap 6 en 7 delen één `haalOrderRegels()`-aanroep. Twee losse aanroepen binnen één run is precies wat de WAF eerder liet stranden (CONVENTIONS-regel 2), en dat ging over exact deze functie.

Deze taak bevat ook de fix uit Bijlage A — die zit in dezelfde regels, dus splitsen zou betekenen dat je het blok twee keer herschrijft.

**Files:**
- Modify: `google-apps-script/deelnemers/Dagelijks.gs:164-175`
- Modify: `google-apps-script/deelnemers/Financieel.gs` (nieuwe functie `bepaalFinancieelSeizoen`)
- Modify: `tests/gs/financieel.test.js`

**Interfaces:**
- Consumes: `leesStrippen()`, `schrijfStrippen()` (Task 7), `upsertStrippen()` (Task 6), `config.cyclus_kalender` (Task 8).
- Produces: `bepaalFinancieelSeizoen(datum)` → seizoencode volgens de 1-junigrens.

- [ ] **Stap 1: Schrijf de falende test voor de seizoensbug**

Voeg toe aan `tests/gs/financieel.test.js`, en zet `bepaalFinancieelSeizoen` in de require-regel bovenaan:

```javascript
test('bepaalFinancieelSeizoen gebruikt de 1-junigrens van dit rapport', () => {
  // Dit is de reden dat deze functie bestaat: bepaalSeizoen() (Deelnemers.gs) hanteert
  // 1 augustus en geeft in juni/juli nog het VORIGE seizoen terug. Dagelijks.gs voedde
  // berekenFinancieel() met bepaalSeizoen(vandaag), waardoor het rapport in juni en juli
  // het oude seizoen toonde EN de nieuwe juniorders buiten het venster vielen -- precies
  // de orders waarvoor de 1-junigrens is bedacht (ADR-009).
  assert.strictEqual(bepaalFinancieelSeizoen('2026-06-01'), '2627');
  assert.strictEqual(bepaalFinancieelSeizoen('2026-06-15'), '2627');
  assert.strictEqual(bepaalFinancieelSeizoen('2026-07-31'), '2627');
  assert.strictEqual(bepaalFinancieelSeizoen('2026-08-04'), '2627');
  assert.strictEqual(bepaalFinancieelSeizoen('2027-05-31'), '2627');
  assert.strictEqual(bepaalFinancieelSeizoen('2026-05-31'), '2526');
});

test('bepaalFinancieelSeizoen en bepaalSeizoen lopen in juni/juli bewust uiteen', () => {
  const { bepaalSeizoen } = require('../../google-apps-script/deelnemers/Deelnemers.gs');
  assert.strictEqual(bepaalSeizoen('2026-06-15'), '2526');
  assert.strictEqual(bepaalFinancieelSeizoen('2026-06-15'), '2627');
  // Buiten juni/juli zijn ze gelijk.
  assert.strictEqual(bepaalSeizoen('2026-09-01'), bepaalFinancieelSeizoen('2026-09-01'));
});
```

- [ ] **Stap 2: Draai de test — hij moet falen**

Run: `node --test tests/gs/financieel.test.js`
Verwacht: FAIL met `bepaalFinancieelSeizoen is not a function`.

- [ ] **Stap 3: Voeg `bepaalFinancieelSeizoen` toe aan `Financieel.gs`**

Direct ná `seizoenEinddatum`:

```javascript
/**
 * Seizoencode volgens de 1-JUNI-grens van dit rapport.
 *
 * bepaalSeizoen() (Deelnemers.gs) hanteert 1 augustus en geeft in juni/juli dus nog het
 * VORIGE seizoen terug -- terwijl dit rapport juist bestaat om vroege cyclusverkoop bij
 * het NIEUWE seizoen te tellen (ADR-009). Dagelijks.gs voedde berekenFinancieel() met
 * bepaalSeizoen(vandaag): in juni en juli toonde het rapport daardoor het oude seizoen,
 * en vielen de nieuwe juniorders buiten het datumvenster -- de orders waarvoor de
 * 1-junigrens nota bene bedacht is. Vandaar deze eigen functie.
 *
 * Dit is dus GEEN derde seizoensbegrip: het is de bestaande 1-junigrens van dit bestand,
 * nu ook toepasbaar op 'welk seizoen is het vandaag' in plaats van alleen op de
 * datumgrenzen van een gegeven seizoen.
 *
 * @param {string} datum 'YYYY-MM-DD'
 * @return {string} bijv. '2627'
 */
function bepaalFinancieelSeizoen(datum) {
  const jaar  = Number(String(datum).slice(0, 4));
  const maand = Number(String(datum).slice(5, 7));
  const start = maand >= 6 ? jaar : jaar - 1;
  return String(start).slice(2) + String(start + 1).slice(2);
}
```

En in het export-blok onderaan:

```javascript
if (typeof module !== 'undefined') {
  module.exports = {
    bepaalInschrijvingType: bepaalInschrijvingType,
    seizoenStartdatum: seizoenStartdatum,
    seizoenEinddatum: seizoenEinddatum,
    bepaalFinancieelSeizoen: bepaalFinancieelSeizoen,
    berekenFinancieel: berekenFinancieel
  };
}
```

- [ ] **Stap 4: Draai de tests tot ze groen zijn**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS.

- [ ] **Stap 5: Vervang het stap 6-blok in `Dagelijks.gs`**

Vervang de bestaande stap 6 (regels 164-175) volledig door:

```javascript
  // Stap 6+7 -- afgeleide rapporten uit DEZELFDE orderregels. Bewust één
  // haalOrderRegels()-aanroep voor beide: een tweede volledige ophaalactie binnen
  // dezelfde run is precies wat de WAF op grovia.nl eerder liet stranden
  // (CONVENTIONS-regel 2, en dat ging over deze functie). Beide stappen staan los van
  // dataBetrouwbaar hierboven -- dit zijn puur afgeleide, read-only rapporten uit de
  // orderregels, geen onderdeel van de Deelnemers-sheet.
  //
  // bepaalFinancieelSeizoen (niet bepaalSeizoen) omdat deze rapporten de 1-junigrens
  // aanhouden; met bepaalSeizoen stond hier in juni en juli het verkeerde seizoen.
  const seizoen = bepaalFinancieelSeizoen(vandaag);
  let orderRegels = null;

  try {
    orderRegels = haalOrderRegels(seizoenStartdatum(seizoen));
    melding.push('Stap 6: ' + orderRegels.length + ' orderregels opgehaald (seizoen ' + seizoen + ').');
  } catch (fout) {
    melding.push('Stap 6 MISLUKT (orderregels ophalen): ' + fout.message);
    logRegel('fout', {}, 'mislukt', 'orderregels: ' + fout.message);
  }

  if (orderRegels) {
    try {
      schrijfFinancieel(berekenFinancieel(orderRegels, config.mapping, seizoen));
      melding.push('Stap 6: Financieel-rapport ververst.');
    } catch (fout) {
      melding.push('Stap 6 MISLUKT (Financieel): ' + fout.message);
      logRegel('fout', {}, 'mislukt', 'financieel: ' + fout.message);
    }

    // Stap 7 -- strippenadministratie. Eerst LEZEN, dan upserten, dan schrijven: het
    // tabblad bevat de handmatig aangevinkte aanwezigheid van de trainer en die mag
    // deze run nooit wegvagen. Eigen try/catch, zodat een stuk Strippen-tabblad het
    // Financieel-rapport hierboven niet meesleept.
    try {
      const strippen = upsertStrippen(
        leesStrippen(), orderRegels, config.mapping, config.cyclus_kalender, seizoen
      );
      schrijfStrippen(strippen.rijen);
      melding.push('Stap 7: Strippen bijgewerkt (' + strippen.rijen.length +
        ' rij(en), ' + strippen.nieuweKaarten + ' nieuwe kaart(en)).');
    } catch (fout) {
      melding.push('Stap 7 MISLUKT: ' + fout.message);
      logRegel('fout', {}, 'mislukt', 'strippen: ' + fout.message);
    }
  }
```

- [ ] **Stap 6: Werk de docblock bovenaan `Dagelijks.gs` bij**

De comment op regel 2 zegt "zes stappen in vaste volgorde". Dat zijn er nu zeven:

```javascript
/**
 * De dagelijkse run: zeven stappen in vaste volgorde.
 *
 * Kernregel: als de afrondingsdata van deze run niet betrouwbaar is, gaan er GEEN
 * reminders uit. Een gemiste dag kost niets — morgen loopt de run weer. Een reminder
 * naar een kind dat de test gisteren gemaakt heeft, kost het vertrouwen in het systeem.
 *
 * Stap 6 (Financieel) en stap 7 (Strippen) delen één haalOrderRegels()-aanroep en staan
 * los van die kernregel: het zijn afgeleide rapporten, geen mailbeslissingen.
 */
```

- [ ] **Stap 7: Draai alles**

Run: `node --test tests/gs/*.test.js`
Verwacht: PASS.

Run: `venv/bin/pytest tests/ -q`
Verwacht: PASS (105 passed) — Python is niet geraakt, maar bevestig dat er niets is meegesleept.

- [ ] **Stap 8: Commit**

```bash
git add google-apps-script/deelnemers/Dagelijks.gs google-apps-script/deelnemers/Financieel.gs tests/gs/financieel.test.js
git commit -m "feat: stap 7 strippenadministratie + fix verkeerd seizoen in juni/juli"
```

### Task 10: Het tabblad aanmaken en einde-tot-eind verifiëren

**Files:** geen (werkboek + Apps Script-editor)

- [ ] **Stap 1: Maak het tabblad `Strippen` aan**

Nieuw tabblad, exact die naam (`_tab()` gooit een `Tabblad "Strippen" niet gevonden`-fout bij een afwijking). Zet in rij 1 de kopregels, in **exact deze volgorde** — `STRIPPEN_KOLOMMEN` leest op positie, niet op naam:

| A | B | C | D | E | F | G | H..O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|
| seizoen | cyclus | naam_slug | naam_kind | vereniging | order_ids | gekocht | T1 … T8 | gebruikt | over | laatste_order_op | opmerking |

- [ ] **Stap 2: Zet de order_ids-kolom (F) op tekstformaat**

Kolom F selecteren → Opmaak → Getal → **Platte tekst**. `schrijfStrippen` doet dit ook per run, maar de kolominstelling vooraf dekt ook handmatige invoer.

- [ ] **Stap 3: Upload alle gewijzigde `.gs`-bestanden naar de Apps Script-editor**

`Strippen.gs` (nieuw), `Sheet.gs`, `Config.gs`, `Dagelijks.gs`, `Financieel.gs`, `Woo.gs`. **Let op:** een ontbrekend bestand in de editor heeft eerder al een run laten falen (zie de Financieel-livegang in HANDOFF). Controleer na het uploaden dat alle bestanden in de editorlijst staan.

- [ ] **Stap 4: Draai `menuVerversAlles` (Grovia → Alles nu verversen)**

Die roept `dagelijkseRun(false)` aan: verversen zonder mails. Verwacht in de samenvatting een regel `Stap 7: Strippen bijgewerkt (…)`.

Geen apart menu-item voor Strippen nodig — "Alles nu verversen" dekt het, en een los item zou een tweede WooCommerce-ophaalactie betekenen.

- [ ] **Stap 5: Controleer het tabblad**

| Te controleren | Verwacht |
|---|---|
| Eén rij per testorder uit Task 2 stap 6 | ja, mits die orders nog bestaan; anders plaats één nieuwe testorder |
| `gekocht` | 4/6/8 volgens de gekochte variant |
| `order_ids` | als **tekst** in de cel, niet rechts uitgelijnd als getal |
| `cyclus` | de code uit de kalender, of leeg als je die leeg liet |
| `gebruikt` / `over` | 0 en `gekocht` |
| Cyclusproduct- of seizoenkaartorders van KA/SU | **staan er niet in** |

- [ ] **Stap 6: Test de waarborg die het hele tabblad draagt**

1. Zet in een rij `x` in **T1** en **T2**.
2. Draai "Alles nu verversen" opnieuw.
3. Controleer: **T1 en T2 staan er nog**, `gebruikt` = 2, `over` = `gekocht` - 2.

Zijn de kruisjes verdwenen, dan is er ergens geschreven zonder eerst te lezen. Stop en zoek dat op vóór je de trainer toegang geeft — dit is de enige manier waarop dit tabblad stil data kan verliezen.

- [ ] **Stap 7: Draai nóg een keer en bevestig dat er niets dubbel geteld wordt**

`gekocht` moet gelijk blijven. Verandert het, dan werkt de `order_ids`-dedup niet en is de oorzaak vrijwel zeker de getalnotatie op kolom F (stap 2).

- [ ] **Stap 8: Deel het werkboek met de trainer**

Let op de GCP-kwestie uit HANDOFF: het Apps Script hangt onder een eigen GCP-project (`grovia-504418`) en wie het script uitvoert moet als **testgebruiker** in het OAuth-toestemmingsscherm staan (Audience → Test users). Voor alleen kijken en aanvinken in de sheet is dat niet nodig; voor het menu wel.

- [ ] **Stap 9: Leg een korte instructie voor de trainer vast**

Eén alinea bovenaan het tabblad of in een cel naast de kop: zet een `x` in de kolom van de training waarop het kind aanwezig was; `over` telt automatisch terug; een negatief getal betekent meer getraind dan betaald; raak de kolommen A t/m G niet aan, die vult het script.

---

# SPOOR 3 — MiniMove in het Financieel-rapport (nu niet doen)

**Alleen als B5 "ja" wordt.** Ik laad hem niet als taken uit, want er zit een openstaande vraag vóór de code: de afdracht van € 20 per deelnemer per cyclus geldt richting een vereniging, en MiniMove is Grovia's eigen product. Wat "afdracht" daar betekent moet eerst bepaald worden.

De code-omvang als het zover komt: `VERENIGINGEN` in [Financieel.gs:70](../../../google-apps-script/deelnemers/Financieel.gs:70) uitbreiden met `'MM'`, `bepaalInschrijvingType` een strippenkaarttype laten teruggeven, `FINANCIEEL_KOLOMMEN` uitbreiden met strippenkolommen, en `FINANCIEEL_AFDRACHT_PER_DEELNEMER` per vereniging configureerbaar maken in plaats van één constante. Reken op een halve dag inclusief tests, niet op een uur — en op een gesprek met Berry vooraf.

Tussenoplossing als je alleen de omzet wil zien: het `Strippen`-tabblad heeft de bedragen al binnen bereik (`regel.bedrag` in `haalOrderRegels`). Eén extra kolom `omzet` in `STRIPPEN_KOLOMMEN` en één regel in `upsertStrippen` geeft je MiniMove-omzet per kind per cyclus, zonder de afdrachtvraag te openen.

---

# SPOOR 5 — Maatuitvraag laten meewerken met de strippenkaarten (herzien, doe dit)

**Dit spoor is volledig herschreven.** Mijn vorige versie stelde voor een nieuwe plugin te bouwen (order-meta, checkoutveld, alles vanaf nul) — onnodig werk, want zoals je zelf aangaf bestaat dit al. Ik heb het nagekeken op de live site in plaats van er nogmaals van uit te gaan.

### Wat er op grovia.nl al staat

Op zowel de MiniMove-productpagina als "Voetbaltraining – Kolping Academie" zit een werkend maatuitvraag-blok: drie optionele velden (`tenue_maat_shirt`, `tenue_maat_broekje`, `tenue_maat_sokken`) met precies de maten die de Jako-teamshop hanteert (92-152 + XS-XXL voor shirt/broek, schoenmaatbandjes 27-46 voor sokken). Verschijnt via een klasse `.ka-tenue-sizes`, geen van de drie velden is verplicht, standaardoptie is leeg.

**Dit mechanisme staat niet in deze git-repo.** Het draait via een los, inline `<script>`-blok dat identiek voorkomt op twee totaal verschillende producten — dus vrijwel zeker één gedeeld Elementor-productsjabloon (Theme Builder → "Single Product", toegepast op alle producten) of een site-brede code-snippet-plugin, niet iets dat per product is gedupliceerd. Zie de nieuwe melding in `docs/DOC-SIGNALS.md` — dit hoort ooit in `ARCHITECTURE.md` te landen, maar dat is voor `/dag-afsluiting`, niet voor nu.

### Waarom het niet vanzelf voor de strippenkaarten gaat werken

De zichtbaarheid wordt bepaald door dit stukje van het live script:

```javascript
function needsSizesFromValue(v){
    const val = String(v || '').toLowerCase();
    return val.includes('tenue') && !val.includes('zonder');
}
```

Het maatblok verschijnt dus alleen als de gekozen `pa_inschrijving`-waarde de tekst "tenue" bevat én niet "zonder" — in de praktijk uitsluitend bij `seizoenkaart-inclusief-tenue`. De nieuwe slugs `strippenkaart-4-keer` / `-6-keer` / `-8-keer` bevatten geen "tenue", dus zonder ingreep **verschijnt het maatblok voor geen enkele strippenkaart-koop** — feitelijk hetzelfde als "voorlopig handmatig", maar niet wat je vroeg.

### Task 11: Eén voorwaarde verbreden (vervangt de oude Task 11/12)

**Files:** geen bestand in deze repo — dit is een wijziging in het live site-mechanisme zelf (zie hierboven waar dat vermoedelijk zit).

- [ ] **Stap 1: Vind het script**

Zoek in WordPress naar waar dit stukje JavaScript staat. Meest waarschijnlijke plekken, in volgorde van waarschijnlijkheid:
1. Elementor → Templates → Theme Builder → een "Single Product"-sjabloon (toegepast op alle WooCommerce-producten) → een "Custom Code" of HTML-widget daarin.
2. Een code-snippet-plugin (zoek in Plugins naar "WPCode", "Code Snippets", "Insert Headers and Footers" of vergelijkbaar).
3. Een child-theme-bestand (`functions.php` of een los `.js`-bestand) — minder waarschijnlijk gezien de inline plaatsing, maar controleer als 1 en 2 niets opleveren.

Zoek in de code specifiek naar de tekst `ka-tenue-sizes` of `needsSizesFromValue` om zeker te zijn dat je het juiste blok gevonden hebt.

- [ ] **Stap 2: Verbreed de voorwaarde**

Vervang:

```javascript
function needsSizesFromValue(v){
    const val = String(v || '').toLowerCase();
    return val.includes('tenue') && !val.includes('zonder');
}
```

door:

```javascript
function needsSizesFromValue(v){
    const val = String(v || '').toLowerCase();
    return (val.includes('tenue') && !val.includes('zonder')) || val.includes('strippenkaart');
}
```

Dat is de volledige wijziging — één voorwaarde, geen andere regel in dit script hoeft aangepast. De rest van het mechanisme (welke velden getoond worden, dat ze optioneel zijn, hoe de data wordt opgeslagen) blijft precies zoals het al werkt voor de seizoenkaart.

- [ ] **Stap 3: Testen met dezelfde 100%-kortingscode als Task 2**

| Te controleren | Verwacht |
|---|---|
| Checkout met een strippenkaart (4/6/8 keer) in de winkelwagen | maatvelden zichtbaar (shirt, broekje, sokken), alle drie optioneel |
| Checkout met `Cyclus 1/2/3` (áls die nog bestaan naast de strippenkaarten) | maatvelden **niet zichtbaar** — ongewijzigd gedrag |
| Checkout met `Seizoenkaart – inclusief tenue` | maatvelden zichtbaar — bevestigt dat je de bestaande werking niet gebroken hebt |
| Checkout met `Seizoenkaart – zonder tenue` | maatvelden **niet zichtbaar** — bevestigt de "zonder"-uitsluiting nog werkt |
| Order geplaatst met een strippenkaart en ingevulde maten | maten leesbaar terug te vinden bij de order (zelfde plek als bij bestaande seizoenkaart-orders met tenue — controleer waar dat vandaag al staat, dat verandert hier niet) |

- [ ] **Stap 4: Ruim de testorders op**

Geen commit-stap hier — dit wijzigt geen bestand in deze repo. Noteer in de eigen `docs/DECISIONS.md`-notitie (ADR-012) dát en waar deze wijziging is doorgevoerd, zodat een volgende sessie weet dat het is aangepast.

---

# Testchecklist (na afloop, in één keer)

| # | Test | Verwacht |
|---|---|---|
| 1 | `node --test tests/gs/*.test.js` | alles groen — relevant zodra je Spoor 2 alsnog bouwt; voor morgen (Spoor 0+1) niet nodig |
| 2 | `venv/bin/pytest tests/ -q` | 105 passed (niet geraakt) |
| 3 | `func start` | host start, zes functions geregistreerd |
| 4 | Testorder strippenkaart 4 keer | WhatsApp-uitnodiging **wel**, Ixly-mail **niet**, fysio-vinkje **niet zichtbaar** |
| 5 | Idem, Deelnemers-tabblad | **geen** nieuwe rij |
| 6 *(alleen bij Spoor 2)* | Idem, Strippen-tabblad | één rij, `gekocht` = 4 — n.v.t. zolang je bij de handmatige lijst (B4-optie 1) blijft |
| 7 | Testorder cyclusproduct KA (regressie) | Ixly-mail **wel**, Deelnemers-rij **wel** |
| 8 *(alleen bij Spoor 2)* | `x` in T1/T2 → verversen | kruisjes blijven staan, `gebruikt` = 2 |
| 9 *(alleen bij Spoor 2)* | Twee keer verversen | `gekocht` verandert niet |
| 10 | Financieel-tabblad | ongewijzigd t.o.v. vóór dit werk |
| 11 | PHP-debug-log bij een MiniMove-order | zegt `MiniMove doet niet mee aan Ixly/Action Type-assessment` |
| 12 | Testorder strippenkaart, maatvelden (Spoor 5) | shirt/broekje/sokken-maten zichtbaar en optioneel |
| 13 | Testorder `Seizoenkaart – inclusief tenue` én `– zonder tenue` (regressie op Spoor 5) | maatvelden verschijnen bij de eerste, niet bij de tweede — de bestaande werking op dít én andere producten (Kolping/Schagen) is niet geraakt |

**Test 7 en 13 zijn de belangrijkste.** Alle andere tests bewijzen dat het nieuwe werkt; 7 en 13 bewijzen dat het bestaande niet gebroken is — MiniMove is een randgeval, KA/SU en de al werkende tenue-toggle zijn de hoofdstroom.

# Rollback

| Spoor | Terugdraaien |
|---|---|
| 0 | Variaties op concept zetten of verwijderen in WooCommerce. Reeds geplaatste orders houden hun `pa_inschrijving`-meta — die blijft leesbaar. |
| 1 | `git revert` van de commit + plugin opnieuw uploaden (versienummer terug). Onbekende slug → oude `continue` op regel 169, functioneel identiek voor MM. |
| 2 | `git revert`, `.gs`-bestanden terugzetten in de editor. **Verwijder het `Strippen`-tabblad niet** — dat is de enige plek waar de aangevinkte aanwezigheid staat en er is geen backup. Hernoem het naar `Strippen (archief)` als het in de weg staat. |
| 4 | `git revert`. Zonder de fix staat het rapport in juni/juli weer op het oude seizoen. |

# Wat je NIET moet aanraken

- **De `MM`-check op [grovia-automations.php:182](../../../plugins/grovia-automations/grovia-automations.php:182).** Weghalen betekent dat MiniMove-kinderen Ixly-kandidaten worden en assessmentmails krijgen. `grovia_mail.bouw_uitnodiging()` geeft voor `MM` `None` terug, dus de mail blijft uit — maar de kandidaat en de assignments worden in Ixly wél aangemaakt ([grovia_mail.py:96-100](../../../grovia_shared/grovia_mail.py:96)). Dat levert stille rommel in Ixly op.
- **De `MM`-check op [Deelnemers.gs:74](../../../google-apps-script/deelnemers/Deelnemers.gs:74).** MiniMove in de Deelnemers-sheet betekent reminders voor testen die MiniMove niet doet.
- **De volgorde van het verzamelen van de WhatsApp-tag t.o.v. de `continue`-regels** in `grovia_generate_ixly_tag`. Die staat bewust vóór de checks; omdraaien breekt `WA_MM_VT`.
- **`GROVIA_BETAALLINK_FASES`.** Een strippenkaartcode daarin zetten stuurt Mollie-betaallinks de deur uit.
- **`bepaalInschrijvingType`'s toegestane lijst** (`C1/C2/C3/SMT/SZT`). Strippenkaarten daarin laten doorkomen zet MiniMove-omzet ongevraagd in de afdrachtberekening.
- **De aangevinkte sessiekolommen in het `Strippen`-tabblad**, mocht je Spoor 2 alsnog bouwen. Geen backup, niet herleidbaar uit WooCommerce.
- **Het `!val.includes('zonder')`-deel van `needsSizesFromValue()` (Spoor 5).** Dat is de enige reden dat `seizoenkaart-zonder-tenue` het maatblok niet toont. Het script staat vermoedelijk op één gedeeld sjabloon voor **alle** producten (MiniMove én Kolping/Schagen) — een fout hier raakt niet alleen de strippenkaarten maar ook de al werkende seizoenkaart-tenue-toggle op de andere producten.

# ADR-012 vastleggen

Als Spoor 0 live staat, leg de beslissing vast in `docs/DECISIONS.md` — bovenaan, boven ADR-011, in het bestaande formaat. Neem hierin mee: de gekozen optie uit B1 met de reden, de prijsstaffel uit B2, de geldigheidsregel uit B3, de keuze uit B4 (gestart met de handmatige lijst, Spoor 2 klaarliggend), en als gevolg dat de fase-mapping nu op drie plekken staat.

Neem ook Spoor 5 mee, want dat wijzigt iets **buiten deze git-repo**: welk live mechanisme is aangepast (`needsSizesFromValue()` in het inline maatuitvraag-script), waar het staat (zodra je dat hebt gevonden — zie Spoor 5, stap 1) en wanneer. Zonder die aantekening is dit de enige wijziging in dit hele traject die nergens in git terug te vinden is.

---

# Bijlage A — Bug gevonden tijdens het in kaart brengen (niet gevraagd, wel relevant)

**Het Financieel-rapport gebruikt in juni en juli het verkeerde seizoen.**

[Dagelijks.gs:168-170](../../../google-apps-script/deelnemers/Dagelijks.gs:168) doet:

```javascript
const seizoen = bepaalSeizoen(vandaag);
const regels  = haalOrderRegels(seizoenStartdatum(seizoen));
schrijfFinancieel(berekenFinancieel(regels, config.mapping, seizoen));
```

`bepaalSeizoen()` hanteert de **1-augustusgrens**. Op 2026-06-15 geeft die `'2526'`. `berekenFinancieel` filtert dan op `datum >= 2025-06-01 && datum < 2026-06-01` — en sluit daarmee elke juniorder van 2026 uit. Terwijl ADR-009 en de test op [financieel.test.js:128](../../../tests/gs/financieel.test.js:128) juist vastleggen dat die vroege juniorders bij het **nieuwe** seizoen moeten tellen. `Financieel.gs` roept `bepaalSeizoen()` nergens aan (dat staat er zelfs als comment) — maar `Dagelijks.gs` voedt hem er wel mee. De invariant wordt bij de aanroeper gebroken, niet in het bestand dat hem beschrijft.

**Impact:** in juni en juli staat het rapport op het vorige seizoen en missen de nieuwe cyclusorders. Elf maanden per jaar klopt het. Vandaag (4 augustus) klopt het, dus dit is niet urgent — maar het is wel stil, en de eerstvolgende keer dat het bijt is juni 2027, ver van deze sessie.

**Fix:** `bepaalFinancieelSeizoen()` met de 1-junigrens. Volledig uitgewerkt in Task 9, stap 1-4.

**Waarom in dit plan:** het zit in exact de regels die Spoor 2 herschrijft, en `Strippen.gs` erft dezelfde seizoensbepaling. Los meenemen zou betekenen dat je hetzelfde blok twee keer aanpakt.

---

# Zelfreview

**Spec-dekking.** Drie strippenkaarten 4/6/8 → Task 2. "Prijs te hoog" → B2 met staffel. "Te weinig flexibiliteit" → B1 (varianten) + Spoor 2 (afstrepen). "Afnemen in de cyclus, cyclus is 8" → `STRIPPEN_PER_CYCLUS` + 8 sessiekolommen + `bepaalCyclus`. "Zonder al te veel aanpassingen" → Deel 0 met bewijs dat Spoor 0 nul code is. "Alle mogelijke opties" → B1 (4 opties), B3 (3), B4 (5), plus Spoor 3 en de tussenoplossing daar.

**Twee dingen die ik niet heb kunnen verifiëren**, omdat ze WooCommerce-toegang vragen: (1) of MiniMove-producten vandaag variabel zijn en `pa_inschrijving` gebruiken — daarom is Task 1 een aparte inventarisatietaak met een expliciet stop-punt, en (2) of `minimove` en `voetbaltraining` beide op het hoofdproduct staan, wat de enige harde eis uit de code is. Beide staan als eerste taak, vóór er iets gewijzigd wordt.

**Eén open aanname die ik niet heb kunnen wegnemen:** dat MiniMove één cyclus tegelijk verkoopt. Daarop rust de aanbeveling A1 (cyclus uit de orderdatum in plaats van uit de variant). Verkoopt Grovia cycli vooruit, dan is A2 of B nodig en verandert Task 2 én de rijsleutel in Spoor 2. Dat is de enige beslissing in dit plan die achteraf duur is om te herzien — vandaar dat B1 als blokkerend gemarkeerd staat.
