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


# De state-waarden waarmee Ixly een afgeronde taak aanduidt.
#
# Ixly gebruikt 'finished' -- NIET 'completed'. Dat laatste was een aanname die nooit
# tegen de live API is gecontroleerd (en die de tests hier jarenlang meecodeerden, dus
# groene tests bewezen niets): 'completed' komt in swagger.yaml nergens voor als
# state-waarde, alleen 'created' staat er als voorbeeld. Geverifieerd 2026-08-11 tegen
# GET /candidate_tasks/{uuid} van Jack Korver (order 1246): beide games stonden op
# 'finished' met een gevulde completed_at, terwijl de Sheet op ixly_af=NEE bleef.
#
# 'completed' blijft erin staan als vangnet mocht Ixly de term ooit alsnog gebruiken --
# een extra toegestane waarde kost niets, een gemiste waarde blokkeert de terugkoppeling
# stil (geen foutmelding, alleen een rij die eeuwig op NEE blijft).
AFGERONDE_STATES = {"finished", "completed"}


def _bepaal_afronding(taken: list) -> dict:
    """
    Alles afgerond betekent afgerond. Geen taken betekent niet afgerond.

    Returns:
        {'af': bool, 'completed_at': 'YYYY-MM-DD' of ''}
    """
    if not taken:
        return {"af": False, "completed_at": ""}

    afgerond = [t for t in taken if t.get("state") in AFGERONDE_STATES]
    if len(afgerond) != len(taken):
        return {"af": False, "completed_at": ""}

    datums = sorted(t.get("completed_at", "") for t in afgerond if t.get("completed_at"))
    laatste = datums[-1][:10] if datums else ""
    return {"af": True, "completed_at": laatste}


def _haal_taken_voor_order(tokens, taken_refs: list) -> dict:
    """
    Vraagt per bewaarde assignment-uuid de status op.

    Elke taak levert altijd een item in de teruggegeven 'taken'-lijst op (nooit stil
    overgeslagen bij een 404 of onbekende taaksoort) -- anders zou _bepaal_afronding een
    kortere lijst zien dan er taken zijn, en zo een taak die niet te achterhalen was
    verkeerd als 'afgerond genoeg' kunnen meetellen.

    tokens: één token (str, o.a. in tests) of de lijst van haal_alle_tokens(). Assignments
    zijn org-breed zichtbaar (geverifieerd 2026-08-12: elk adviseur-token geeft 200 op
    dezelfde assignment) -- daarvoor volstaat tokens[0]. candidate_tasks zijn dat NIET:
    die zijn alleen zichtbaar voor de adviseur die de kandidaat bezit, dus daarvoor gaat
    de volledige lijst naar haal_taak_status().
    """
    if isinstance(tokens, str):
        tokens = [tokens]

    taken = []
    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(tokens[0], ref["assignment_uuid"])
        if not assignment:
            taken.append({"naam": ref["naam"], "state": "", "completed_at": ""})
            continue

        soort, taak_uuid = ixly_api.taakverwijzing(assignment)

        if not soort:
            taken.append({"naam": ref["naam"], "state": "", "completed_at": ""})
            continue

        status_dict = ixly_api.haal_taak_status(tokens, soort, taak_uuid)
        taken.append({
            "naam":         ref["naam"],
            "state":        status_dict["state"],
            "completed_at": status_dict["completed_at"],
        })

    return {"taken": taken, **_bepaal_afronding(taken)}


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
