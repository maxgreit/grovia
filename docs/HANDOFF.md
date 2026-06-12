# Handoff — Grovia Automations

**Datum:** 2026-06-12
**Status:** WhatsApp uitnodiging flow gebouwd — klaar voor FunnelKit automation inrichting + deploy

---

## Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** zie git log
- **Build:** Syntax OK (`py_compile` geslaagd)

---

## Wat er deze sessie is gebeurd

### WhatsApp Azure Function
- Template naam gecorrigeerd naar `groviagroepsappuitnodiging` (was `groviagroepsapp`)
- `components` toegevoegd aan Meta API-aanroep: `{{1}}` voornaam, `{{2}}` schoolnaam, `{{3}}` groepslink
- `order_id` optioneel gemaakt (alleen voor logging, niet vereist)
- `schoolnaam` en `groepslink` toegevoegd als verplichte payload-velden

### grovia-automations.php
- `type_map` toegevoegd: voetbaltraining (VT), keeperstraining (KT)
- `school_map` uitgebreid met MiniMove (MM)
- Evenementen worden uitgesloten van WhatsApp trigger
- Na elke order worden WA trigger tags aangemaakt en toegewezen: `WA_{school}_{type}`

### WP productcategorieën (door Berry)
- Toegevoegd: `voetbaltraining`, `keeperstraining`, `evenement`
- MiniMove `voetbaltraining` categorie: nog toevoegen aan het reguliere MiniMove-product

### Retroactieve migratie
- `WAGroep_` guard-tags ingesteld voor alle bestaande klanten via `grovia-retroactief.php`
- Script is uitgevoerd en verwijderd van de server

### GitHub Actions deploy.yml
- WhatsApp secrets toegevoegd: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAAM`
- GitHub Secrets aangevuld door Max

---

## Open items / Next steps

### Prioriteit 1 — FunnelKit automation inrichten
Één automation met decision tree:
- **Trigger:** Any Tag → `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`
- **Per branch:**
  1. Remove Tag: `WA_KA_VT` (opruimen)
  2. Conditie: geen `WAGroep_KA_VT` → anders stop
  3. HTTP Request → Azure Function whatsapp-uitnodiging
  4. Add Tag: `WAGroep_KA_VT`

**HTTP Request payload:**
```json
{
  "voornaam":   "{{contact_first_name}}",
  "achternaam": "{{contact_last_name}}",
  "telefoon":   "{{contact_phone}}",
  "schoolnaam": "Kolping Academie",
  "groepslink": "https://chat.whatsapp.com/LINK_HIER"
}
```

### Prioriteit 2 — Groepslinks ophalen bij Berry
Benodigd:
- Kolping Academie voetbal groepslink
- Kolping Boys keepers groepslink
- Schagen United voetbal groepslink
- Schagen United keepers groepslink
- MiniMove groepslink

### Prioriteit 3 — Deploy pushen
Push naar main → GitHub Actions deployt automatisch naar Azure.

---

## Belangrijke context

### WhatsApp WABA-structuur
- **Grovia WABA** (ID: 1320633513537881) — de juiste WABA
- **Phone Number ID:** 1192313800624887 (+31 6 53870629)
- **Template:** `groviagroepsappuitnodiging` — Dutch (nl) — Actief

### Tag-structuur WhatsApp flow
- **Trigger tags** (PHP → FunnelKit): `WA_KA_VT`, `WA_KA_KT`, `WA_SU_VT`, `WA_SU_KT`, `WA_MM_VT`
- **Guard tags** (FunnelKit → contact, eenmalig): `WAGroep_KA_VT`, `WAGroep_KA_KT`, `WAGroep_SU_VT`, `WAGroep_SU_KT`, `WAGroep_MM_VT`
- Trigger tag wordt direct verwijderd door FunnelKit; guard tag blijft permanent staan

### School/type mapping (grovia-automations.php)
```
school_map: schagen-united → SU, kolping-academie → KA, minimove → MM
type_map:   voetbaltraining → VT, keeperstraining → KT
uitsluit:   evenement
```

### Azure Function whatsapp-uitnodiging payload
```json
{
  "voornaam":   "Jan",
  "achternaam": "Jansen",
  "telefoon":   "0612345678",
  "schoolnaam": "Kolping Academie",
  "groepslink": "https://chat.whatsapp.com/..."
}
```
`order_id` is optioneel (alleen logging).
