# Design: Toestemmingsvinkje fysieke intakes (fysiopraktijk)

**Datum:** 2026-07-27 · **Auteur:** Max Rood (met Claude) · **Status:** goedgekeurd ontwerp

## Doel

Ouders kunnen bij het afrekenen op grovia.nl toestemming geven voor (1) het afnemen van
fysieke intakes en behandelingen door de fysiopraktijk en (2) het declareren daarvan bij de
zorgverzekeraar. De toestemming is vrijwillig, maar zonder toestemming kan het kind niet
meedoen aan de intakes. Terminologie overal: **"intakes en behandelingen"**, nooit "testen"
(eis van de fysiopraktijk en de zorgverzekeraar).

## Context (bevindingen inspectie 2026-07-27)

- grovia.nl draait een **klassieke WooCommerce-checkout** (geen checkout blocks) —
  PHP-hooks werken zoals in de bestaande `grovia-automations` plugin.
- Er is al een standaard `terms`-vinkje (algemene voorwaarden); het nieuwe vinkje komt
  daar direct onder.
- Bestaande custom checkoutvelden `grovia_kind_naam` / `grovia_kind_geboortedatum` leven
  **buiten deze repo** (op de site zelf); dit project raakt die code niet aan.
- `grovia-automations.php` heeft een herbruikbaar patroon voor categorie-detectie met
  uitsluitlijst `['evenement', 'proef-training']` en slug `minimove`.

## Scope-beslissingen

| Beslissing | Keuze |
|---|---|
| Codeplek | **Aparte, nieuwe plugin** `plugins/grovia-fysio-toestemming/` (eigen logische plek, versiebeheerd in deze repo) |
| Conditie | **Opt-in productcategorie** `toestemming-vereist` — vinkje verschijnt alleen bij producten met deze categorie |
| Informatiedocument | Bestaat nog niet → **WP-pagina** met concepttekst, inhoudelijk te valideren door Berry/fysiopraktijk |
| Registratie | **Order-meta + zichtbaar in WP-admin orderscherm** (geen FunnelKit-tag, geen mails) |
| Nudge | **Eénmalige pop-up** bij afrekenen zonder vinkje |
| Verplicht? | Nee — bestelling kan altijd door, met of zonder toestemming |

## Componenten

### 1. Informatiepagina (handmatig in WordPress)

Nieuwe pagina, voorstel-slug: `/toestemming-fysieke-intakes`. Concepttekst wordt in de
implementatiefase aangeleverd (apart bestand in de repo) en behandelt minimaal:

- wat de intakes en behandelingen inhouden;
- wie ze afneemt (de fysiopraktijk);
- waar ze voor bedoeld zijn;
- welke gegevens met de fysiopraktijk worden gedeeld;
- dat de behandeling wordt gedeclareerd bij de zorgverzekeraar.

⚠️ Publicatie pas na inhoudelijke akkoord van Berry/de fysiopraktijk.

### 2. Plugin `grovia-fysio-toestemming`

Eén bestand: `plugins/grovia-fysio-toestemming/grovia-fysio-toestemming.php`.
Stijl en conventies volgen `grovia-automations` (Nederlands, `error_log` voor logging,
geen secrets in code).

**a. Conditie (wanneer tonen):** opt-in via een nieuwe productcategorie
**"Toestemming Vereist"** (slug: `toestemming-vereist`). Het vinkje verschijnt alleen als
de winkelwagen minstens één product met deze categorie bevat. Producten zonder de
categorie (MiniMove, evenementen, proeftrainingen, toekomstige producten) zien het vinkje
nooit — veiliger dan een uitsluitlijst, en Berry stuurt het zelf door de categorie aan een
product te hangen. Zelfde `wp_get_post_terms`-aanpak als de bestaande plugin; bij
variaties geldt de categorie van het hoofdproduct (`parent_id`).

⚠️ Vereist eenmalige inrichting in WooCommerce: categorie aanmaken + aan de juiste
producten hangen (voetbaltrainingen en keeperstrainingen; NIET aan de bestaande
schoolcategorieën zoals `kolping-academie` koppelen — het is een extra, losse categorie).

**b. Vinkje:** hook `woocommerce_review_order_before_submit`, direct onder het
voorwaarden-vinkje. Niet verplicht, standaard uit. Tekst (concept):

> Ik geef toestemming voor de fysieke intakes en behandelingen door de fysiopraktijk en
> het declareren hiervan bij de zorgverzekeraar. [Lees hier wat dit inhoudt →]

De link opent de informatiepagina in een nieuw tabblad. De pagina-URL staat als constante
bovenin de plugin (geen hardcoded verspreide strings).

**c. Pop-up-nudge (inline JS vanuit de plugin):** bij klik op "Bestelling plaatsen"
zonder vinkje verschijnt één keer een overlay:

- Uitleg: zonder toestemming kan het kind niet meedoen aan de fysieke intakes van de
  fysiopraktijk.
- Knop **"Alsnog toestemming geven"** → zet het vinkje aan en vervolgt het afrekenen.
- Knop **"Doorgaan zonder toestemming"** → sluit de overlay; volgende klik rekent
  gewoon af (pop-up verschijnt niet opnieuw; flag in `sessionStorage`).

De JS werkt met de klassieke checkout (jQuery-`checkout_place_order` event van
WooCommerce), degradeert netjes: zonder JS is het vinkje er gewoon, alleen de nudge
ontbreekt.

**d. Opslag:** op `woocommerce_checkout_create_order`:

- `_grovia_fysio_toestemming` = `ja` / `nee`
- `_grovia_fysio_toestemming_tijdstip` = ISO-tijdstip van de bestelling

Alleen opslaan als het vinkje daadwerkelijk getoond is (dus niet op uitgesloten
bestellingen). Zo betekent afwezige meta "niet van toepassing" en `nee` "bewust niet
gegeven" — belangrijk onderscheid voor de fysiopraktijk.

**e. Admin-weergave:** hook `woocommerce_admin_order_data_after_billing_address` toont in
het orderscherm: "Toestemming fysieke intakes: **Ja/Nee** (tijdstip)". Bij afwezige meta:
niets tonen.

## Wat bewust buiten scope blijft (YAGNI)

Geen FunnelKit-tag, geen mail-aanpassingen, geen blokkade van de bestelling, geen aparte
opslag buiten WooCommerce, geen checkout-blocks-ondersteuning (site gebruikt ze niet).

## Testplan

1. `php -l` op het pluginbestand (lokaal).
2. Op de site (na deploy):
   - checkout met product mét categorie `toestemming-vereist` → vinkje zichtbaar;
   - checkout met alleen producten zónder die categorie (MiniMove, proeftraining) → geen vinkje;
   - afrekenen zonder vinkje → pop-up verschijnt precies één keer; beide knoppen werken;
   - order met vinkje aan → meta `ja` + tijdstip zichtbaar in admin;
   - order zonder vinkje → meta `nee`; uitgesloten order → geen meta.

## Deploy

Plugin-map uploaden naar `wp-content/plugins/` en activeren. Kan samenvallen met de nog
openstaande deploy van de debug-mail-fix in `grovia-automations`.
