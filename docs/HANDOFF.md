# Handoff — Grovia Automations

**Datum:** 2026-06-02  
**Status:** MVP live — WhatsApp implementatie in progress (geblokkeerd op Berry)

---

## Laatste werkende staat

- **Branch:** `feature/whatsapp-uitnodiging`
- **Laatste commit:** `9dc96d6 feat: Meta Cloud API template aanroep`
- **Build:** Niet uitgevoerd deze sessie (geen codewijzigingen)

---

## Wat er deze sessie is gebeurd

Sessie was volledig oriënterend/beslissend van aard, geen codewijzigingen. Ontdekt dat het bestaande Grovia WhatsApp Business-nummer niet zomaar gekoppeld kan worden aan de Meta Cloud API: het vereist een migratie waarbij het nummer de WhatsApp Business App verlaat. Dit is onwenselijk omdat Grovia het nummer actief gebruikt voor groepsbeheer. Beslissing genomen: een apart prepaid nummer (nieuw SIM, ~€5 eenmalig) gebruiken voor de API, zodat het bestaande nummer in de app blijft. Dit ligt nu bij Berry om te regelen.

---

## Git wijzigingen

Geen nieuwe commits deze sessie. Uncommitted working copy changes (van vorige sessies):

```
.claude/.template-version
.claude/commands/apply-template.md
.claude/commands/handoff.md
.claude/commands/install-template.md
.claude/commands/start-project.md
.claude/commands/start-session.md
.claude/skills/nacht-instructies.md
tests/test_whatsapp_uitnodiging.py
whatsapp-uitnodiging/__init__.py
```

---

## Open items / Next steps

### Prioriteit 1 — Berry regelt prepaid nummer (blocker)

Berry moet een prepaid SIM-kaart kopen (Lebara of Lycamobile, ~€5, bij Albert Heijn/Kruidvat). Dit nummer wordt het API-nummer voor de WhatsApp-integratie. Eenmalig nodig voor verificatie via SMS.

Na ontvangst nummer:
1. Terug naar **developers.facebook.com → Grovia app → Add phone number**
2. Het nieuwe nummer invullen (niet het bestaande Grovia-nummer)
3. Verificatiecode ontvangen via SMS op de prepaid SIM
4. **Phone Number ID** noteren (staat bij het gekoppelde nummer na verificatie)
5. **Access Token** genereren: Business Manager → Instellingen → Systeemgebruikers → Admin → Token genereren (scope: `whatsapp_business_messaging`)
6. WhatsApp-template aanmaken in WhatsApp Manager (zie plan voor body-tekst)
7. Groepsuitnodigingslink ophalen uit WhatsApp Business App (bestaand nummer)
8. Vier GitHub Secrets toevoegen: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAAM`, `WHATSAPP_GROEP_UITNODIGING_URL`

### Prioriteit 2 — WhatsApp Azure Function deployen

Plan volledig uitgewerkt in `docs/superpowers/plans/2026-05-21-whatsapp-uitnodiging.md`. Code scaffolding en tests al aanwezig in working copy (uncommitted). Kan parallel aan Berry's actie worden afgerond. Gebruik `/subagent-driven-development` om het plan taak voor taak uit te voeren.

### Prioriteit 3 — Meta Business Verification

Als nog niet gedaan: Berry moet via **business.facebook.com → Alle tools → Instellingen → Beveiligingscentrum → Start verificatie** een KvK-uittreksel uploaden. Verificatie duurt 1-2 werkdagen.

---

## Belangrijke context die niet mag verdwijnen

### WhatsApp nummer-beslissing
Het bestaande Grovia WhatsApp Business-nummer (`+31 634760187`) blijft in de WhatsApp Business App — Grovia gebruikt dit voor groepsbeheer. De Meta Cloud API krijgt een **apart prepaid nummer**. Klanten zien dus een ander nummer voor de geautomatiseerde uitnodigingen dan het bekende Grovia-nummer. Dit is een bewuste trade-off.

### Prepaid SIM details
- Aanbevolen: Lebara of Lycamobile
- Te koop: Albert Heijn, Kruidvat, Primera (~€5)
- SIM is na verificatie niet meer actief nodig — bewaren als backup

### Ixly organisatie-UUIDs
- **Staging:** `d6b811e3-afd1-4888-86b1-306a75e2c0ed` (Grovia VOF staging)
- **Productie:** `e8827170-26d4-4447-a094-e618c232ebba` (Grovia VOF) ← actief in GitHub Secret

### Mollie bedrag
Bedrag hardcoded op `"20.00"` in `mollie-betaallink/__init__.py`. FunnelKit hoeft geen `bedrag`-veld meer mee te sturen.

### Meta WhatsApp setup status
- App aangemaakt onder Grovia Business portfolio in developers.facebook.com
- Use case: "Connect with customers through WhatsApp" toegevoegd
- Bestaand nummer NIET migreren — apart prepaid nummer gebruiken
- Pad verificatie: business.facebook.com → Alle tools → Instellingen → Beveiligingscentrum

### Task-UUIDs Ixly (productie = staging = zelfde)
```python
TAKEN = [
    {"naam": "Blocks Game", "uuid": "2a04b8bc-486f-4b9a-924a-26199b75be9c", "type": "Task"},
    {"naam": "Rally Game",  "uuid": "4464b991-268f-45f7-860a-e5b109160612", "type": "Task"},
]
```
