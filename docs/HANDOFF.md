# Handoff — Grovia Automations

**Datum:** 2026-05-26  
**Status:** MVP live — assessment-keten in productie; WhatsApp in voorbereiding (geblokkeerd op Meta verificatie)

---

## Laatste werkende staat

- **Branch:** `main`
- **Laatste commit:** `522eca3 26-06-2026: Hardcoded waarde mollie bedrag aangepast` *(noot: datum in commit message is typo, moet 26-05-2026 zijn)*
- **Build:** `func --version` → 4.5.0 aanwezig. `func start` niet lokaal getest (poort 7071 waarschijnlijk bezet). Laatste Azure deploy slaagde.

---

## Wat er deze sessie is gebeurd

De Ixly assessment-keten is live gezet: `IXLY_ORGANIZATION_UUID` omgezet van staging (`d6b811e3-...`) naar productie (`e8827170-...`) via GitHub Secret, deploy getriggerd en end-to-end getest. Tegelijk ontdekt dat het Mollie-betaalbedrag niet hardcoded was maar uit de FunnelKit-payload kwam (stond op €160); gefixed door `bedrag` op `"20.00"` te hardcoden in `mollie-betaallink/__init__.py` en uit de verplichte velden te verwijderen. Ook `node_modules/` en `package-lock.json` toegevoegd aan `.gitignore` (ontbraken). Daarna start gemaakt met WhatsApp Business API setup via Meta Developer Portal — app aangemaakt, WhatsApp use case toegevoegd, maar geblokkeerd op Business Verification (error 131031: account locked zolang niet geverifieerd).

---

## Git wijzigingen

Commits deze sessie:
- `522eca3` — mollie bedrag hardcoded op €20, `bedrag` uit verplichte velden, .gitignore uitgebreid

Working copy na laatste commit:
- `docs/TODO.md` gewijzigd (deze handoff-update)

Untracked (bewust niet gecommit):
- `.claude/commands/apply-template.md`, `.claude/commands/install-template.md` — template-bestanden
- `.claude/developer` — lokaal config
- `Grovia_Automations_Uitleg.pptx`, `make_presentation.js`, `package.json` — presentatiemateriaal
- `docs/superpowers/plans/2026-05-21-whatsapp-uitnodiging.md` — plan, nog niet relevant voor deploy

---

## Open items / Next steps

### Prioriteit 1 — Meta Business Verification (blocker WhatsApp)

Berry moet inloggen op **business.facebook.com → Instellingen → Beveiligingscentrum** en een KvK-uittreksel uploaden. Dit is de enige blocker voor de WhatsApp-integratie. Verificatie duurt 1-2 werkdagen.

Na goedkeuring:
1. Terug naar **developers.facebook.com → Grovia app → Step 2 Production setup**
2. Bestaand Grovia-nummer koppelen via Embedded Signup
3. **Phone Number ID** noteren (staat bij het gekoppelde nummer)
4. **Access Token** genereren: Business Manager → Instellingen → Systeemgebruikers → Admin → Token genereren (scope: `whatsapp_business_messaging`)
5. WhatsApp-template aanmaken in WhatsApp Manager (zie plan voor body-tekst)
6. Groepsuitnodigingslink ophalen uit WhatsApp Business App
7. Vier GitHub Secrets toevoegen: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAAM`, `WHATSAPP_GROEP_UITNODIGING_URL`

### Prioriteit 2 — WhatsApp Azure Function implementeren

Plan volledig uitgewerkt in `docs/superpowers/plans/2026-05-21-whatsapp-uitnodiging.md`. Kan parallel aan verificatieproces worden geïmplementeerd. Gebruik `/subagent-driven-development` om het plan taak voor taak uit te voeren.

---

## Belangrijke context die niet mag verdwijnen

### Ixly organisatie-UUIDs
- **Staging:** `d6b811e3-afd1-4888-86b1-306a75e2c0ed` (Grovia VOF staging)
- **Productie:** `e8827170-26d4-4447-a094-e618c232ebba` (Grovia VOF) ← actief in GitHub Secret

### Mollie bedrag
Bedrag hardcoded op `"20.00"` in `mollie-betaallink/__init__.py`. FunnelKit hoeft geen `bedrag`-veld meer mee te sturen — het veld wordt ook niet meer gevalideerd als verplicht.

### Meta WhatsApp setup status
- App aangemaakt onder Grovia Business portfolio in developers.facebook.com
- Use case: "Connect with customers through WhatsApp" toegevoegd
- **Geblokkeerd:** error 131031 (Business Account locked) — oorzaak: Business Verification niet afgerond
- Pad naar verificatie: business.facebook.com → Alle tools → Instellingen → Beveiligingscentrum → Start verificatie

### Task-UUIDs Ixly (productie = staging = zelfde)
```python
TAKEN = [
    {"naam": "Blocks Game", "uuid": "2a04b8bc-486f-4b9a-924a-26199b75be9c", "type": "Task"},
    {"naam": "Rally Game",  "uuid": "4464b991-268f-45f7-860a-e5b109160612", "type": "Task"},
]
```
UUIDs zijn organisatie-onafhankelijk bij Ixly — gelden voor zowel staging als productie.

### node_modules in repo
`make_presentation.js` en `package.json` staan als untracked in de root — zijn presentatiescripts, geen projectcode. `node_modules/` en `package-lock.json` zijn nu correct in `.gitignore` opgenomen.
