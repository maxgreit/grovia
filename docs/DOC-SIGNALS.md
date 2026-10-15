# Doc-drift signals — buffer voor /dag-afsluiting

Append-only door `/handoff`. Geleegd door `/dag-afsluiting` in dezelfde commit als de doc-updates.

---

## 2026-10-15 — ARCHITECTURE.md: WhatsApp-route in FunnelKit
- De WhatsApp-uitnodiging loopt via FunnelKit-automation "Groepsapp Uitnodiging" (#6): trigger-tags `WA_<school>_<type>` → tak per tag → `WAGroep_`-check → HTTP-request → `WAGroep_`-tag → WA-tag verwijderen. ARCHITECTURE noemt alleen het endpoint. Neem de checklist "nieuwe academie = trigger-tags + tak per type + WAGroep-tags" op (zie aanvulling ADR-017).
