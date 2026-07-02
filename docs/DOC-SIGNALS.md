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
