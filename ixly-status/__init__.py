"""
Azure Function: Ixly status opvragen.

Krijgt een lijst order-id's en geeft per order terug of de Ixly-taken afgerond zijn.
Aangeroepen door het Apps Script van het werkboek "Grovia Deelnemers".

Payload:
  {"order_ids": ["935", "941"]}

Respons:
  {"resultaten": {
     "935": {"gevonden": true, "af": true, "completed_at": "2026-07-20",
             "taken": [{"naam": "...", "state": "completed", "completed_at": "..."}]},
     "941": {"gevonden": false, "af": false, "completed_at": "", "taken": []}
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
MAX_ORDERS_PER_AANROEP = 100


def _bepaal_afronding(taken: list) -> dict:
    """
    Alles afgerond betekent afgerond. Geen taken betekent niet afgerond.

    Returns:
        {'af': bool, 'completed_at': 'YYYY-MM-DD' of ''}
    """
    if not taken:
        return {"af": False, "completed_at": ""}

    afgerond = [t for t in taken if t.get("state") == "completed"]
    if len(afgerond) != len(taken):
        return {"af": False, "completed_at": ""}

    datums = sorted(t.get("completed_at", "") for t in afgerond if t.get("completed_at"))
    laatste = datums[-1][:10] if datums else ""
    return {"af": True, "completed_at": laatste}


def _haal_taken_voor_order(token: str, order_id: str) -> dict:
    """Zoek de candidate, haal zijn assignments op en bepaal per taak de status."""
    candidate = ixly_api.zoek_candidate(token, order_id)
    if not candidate:
        return {"gevonden": False, "af": False, "completed_at": "", "taken": []}

    taken = []
    for assignment in ixly_api.haal_assignments(token, candidate["id"]):
        relaties = assignment.get("relationships", {})
        for soort in ixly_api.TAAK_RELATIES:
            verwijzing = relaties.get(soort, {}).get("data")
            if not verwijzing:
                continue
            status = ixly_api.haal_taak_status(token, soort, verwijzing["id"])
            taken.append({
                "naam":         soort,
                "state":        status["state"],
                "completed_at": status["completed_at"],
            })

    resultaat = _bepaal_afronding(taken)
    return {"gevonden": True, "taken": taken, **resultaat}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Status gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    order_ids = body.get("order_ids")
    if not order_ids or not isinstance(order_ids, list):
        return func.HttpResponse(
            json.dumps({"fout": "order_ids ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(order_ids) > MAX_ORDERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_ORDERS_PER_AANROEP} order-id's per aanroep."}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        token = ixly_api.haal_token()
    except requests.HTTPError as e:
        logging.error(f"Ixly token fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": "Kon geen Ixly-token ophalen."}),
            mimetype="application/json",
            status_code=502,
        )

    resultaten = {}
    for order_id in order_ids:
        order_id = str(order_id)
        try:
            resultaten[order_id] = _haal_taken_voor_order(token, order_id)
        except requests.HTTPError as e:
            # Eén stukke order blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {
                "gevonden": False, "af": False, "completed_at": "", "taken": [],
                "fout": f"Ixly-fout {e.response.status_code}",
            }

    logging.info(f"Status bepaald voor {len(resultaten)} orders.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
