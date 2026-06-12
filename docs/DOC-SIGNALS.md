# Doc-drift signals — buffer voor /dag-afsluiting

Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

---

## 2026-06-06 — sessie 1 — ARCHITECTURE.md

**Wat:** Nieuwe Azure Function `whatsapp-uitnodiging` toegevoegd — HTTP POST trigger, roept Meta Cloud API aan voor WhatsApp template-berichten
**Code:** `whatsapp-uitnodiging/__init__.py`, `whatsapp-uitnodiging/function.json`
**Commit:** 417a2c7
**Voorgestelde plek:** Componentenoverzicht Azure Functions uitbreiden met whatsapp-uitnodiging + Meta Cloud API als externe service

## 2026-06-06 — sessie 1 — GLOSSARY.md

**Wat:** Nieuwe termen: Phone Number ID (Meta), WhatsApp template, E.164 (telefoonnummer-formaat), WABA (WhatsApp Business Account)
**Code:** `whatsapp-uitnodiging/__init__.py`
**Commit:** 417a2c7
**Voorgestelde plek:** Nieuw blok "WhatsApp / Meta" toevoegen aan glossary

## 2026-06-09 — sessie 2 — ARCHITECTURE.md

**Wat:** WABA-structuur verduidelijkt — Grovia heeft meerdere WABA's; de juiste is "Grovia" (ID: 1320633513537881) met prepaid nummer +31 6 53870629. Template `groviagroepsapp` aangemaakt in deze WABA met 3 body-variabelen (voornaam, schoolnaam, groepslink). `chat.whatsapp.com` links niet toegestaan als knop-URL.
**Code:** `whatsapp-uitnodiging/__init__.py`
**Commit:** (uncommitted — taalcode fix nl)
**Voorgestelde plek:** ARCHITECTURE.md — WhatsApp sectie: WABA-structuur + template opzet toevoegen
