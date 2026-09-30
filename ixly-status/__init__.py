"""
Azure Function: Ixly status opvragen.

Krijgt per order de bewaarde assignment-uuid's (uit WooCommerce order-meta
_grovia_ixly_taken, ingelezen door Apps Script) en geeft terug of de taken zijn
afgerond. Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers".

Vraagt NIET meer de candidate op en NIET meer de assignments-lijst van een candidate --
de publieke Ixly-API heeft daar geen werkend endpoint voor (alleen POST /assignments,
geen GET/lijst-variant, bevestigd tegen swagger.yaml). In plaats daarvan wordt per taak
de al bekende assignment-uuid gebruikt met het wel bewezen werkende
GET /assignments/{uuid}.

Payload:
  {"orders": [
    {"order_id": "1195", "taken": [
      {"naam": "Blocks Game", "assignment_uuid": "39e7d2a1-..."},
      {"naam": "Rally Game",  "assignment_uuid": "8a4f9c22-..."}
    ]}
  ]}

Respons:
  {"resultaten": {
     "1195": {"af": true, "completed_at": "2026-07-20",
              "taken": [{"naam": "Blocks Game", "state": "completed", "completed_at": "..."}]},
     "941":  {"af": false, "completed_at": "", "taken": [], "fout": "..."}
  }}
"""
import json
import logging
import os
import sys

import azure.functions as func
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from grovia_shared import ixly_api

# Bovengrens per aanroep, zodat één verzoek de function niet laat aflopen.
# LET OP: config.ixly_batch_per_run (Config-tabblad in het werkboek, default 50) moet
# altijd <= deze waarde blijven -- anders geeft deze function een HTTP 400 en faalt
# werkIxlyBij met een exception, wat via de dataBetrouwbaar-regel ALLE reminders die dag
# blokkeert. Zie de bijbehorende comment bij ixly_batch_per_run in Config.gs.
MAX_ORDERS_PER_AANROEP = 100


# Verhuisd naar grovia_shared/ixly_api.py (bepaal_afronding, haal_taken_details) zodat
# grovia-herinnering dezelfde afrondingslogica kan hergebruiken voor een verse controle
# vlak vóór een reminder (zie ADR -- Lev Klaver, 2026-09-26: de Sheet had ixly_af=NEE
# terwijl Ixly's eigen completed_at al twee dagen oud was). Aliassen hieronder zodat
# bestaande call sites en tests ongewijzigd blijven.
AFGERONDE_STATES = ixly_api.AFGERONDE_STATES
_bepaal_afronding = ixly_api.bepaal_afronding


def _haal_taken_voor_order(tokens, taken_refs: list) -> dict:
    """Vraagt per bewaarde assignment-uuid de status op (zie ixly_api.haal_taken_details)."""
    details = ixly_api.haal_taken_details(tokens, taken_refs)
    taken = [{"naam": d["naam"], "state": d["state"], "completed_at": d["completed_at"]} for d in details]
    return {"taken": taken, **ixly_api.bepaal_afronding(taken)}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Status gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    orders = body.get("orders")
    if not orders or not isinstance(orders, list):
        return func.HttpResponse(
            json.dumps({"fout": "orders ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(orders) > MAX_ORDERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_ORDERS_PER_AANROEP} orders per aanroep."}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        # Eén token per adviseur, niet één -- zie de docstring bij haal_alle_tokens()
        # en _haal_taken_voor_order() voor waarom een enkel token onvoldoende is.
        tokens = ixly_api.haal_alle_tokens()
    except requests.HTTPError as e:
        logging.error(f"Ixly token fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": "Kon geen Ixly-token ophalen."}),
            mimetype="application/json",
            status_code=502,
        )

    resultaten = {}
    for order in orders:
        order_id = str(order.get("order_id", ""))
        taken_refs = order.get("taken", [])
        if not order_id or not taken_refs:
            continue
        try:
            resultaten[order_id] = _haal_taken_voor_order(tokens, taken_refs)
        except requests.HTTPError as e:
            # Eén stukke order blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {
                "af": False, "completed_at": "", "taken": [],
                "fout": f"Ixly-fout {e.response.status_code}",
            }

    logging.info(f"Status bepaald voor {len(resultaten)} orders.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
