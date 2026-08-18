"""
Azure Function: Ixly-scores opvragen.

Krijgt per deelnemer de bewaarde assignment-uuid's (uit WooCommerce order-meta
_grovia_ixly_taken, doorgegeven door het Apps Script) en geeft de genormeerde scores
van de Blocks- en Rally-games terug. Aangeroepen door het Apps Script van het werkboek
"Grovia Deelnemers", stap 8 van de dagelijkse run.

Geeft alleen 'latent' door (1-10-schaal); 'raw' en 'default_z' zijn voor deze
toepassing ruis. De sleutels blijven die van Ixly zelf -- het vertalen naar Nederlandse
kolomnamen gebeurt op één plek in Scores.gs, zodat deze function niets van de
sheetstructuur hoeft te weten.

Payload:
  {"deelnemers": [
    {"order_id": "1345", "taken": [
      {"naam": "Blocks Game", "assignment_uuid": "293dbc32-..."},
      {"naam": "Rally Game",  "assignment_uuid": "f1c7d406-..."}
    ]}
  ]}

Respons:
  {"resultaten": {
     "1345": {"blocks": {"planning": 4.04, "flexibility": 5.89},
              "rally":  {"performance": 3.59, ...},
              "levels_voltooid": 18, "levels_perfect": 9}
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

# Bovengrens per aanroep, zodat één verzoek de function niet laat aflopen. Zelfde
# waarde als MAX_ORDERS_PER_AANROEP in ixly-status.
MAX_DEELNEMERS_PER_AANROEP = 100

# De games waarvan we scores bewaren. Ixly's respons is cumulatief per kandidaat en kan
# in de toekomst meer games bevatten; wat hier niet in staat wordt genegeerd.
GAMES = ("blocks", "rally")


def _plat(genormeerd: dict) -> dict:
    """
    Reduceert {'planning': {'raw':.., 'default_z':.., 'latent':..}} tot
    {'planning': <latent>}. Schalen zonder latent-waarde vallen af.
    """
    resultaat = {}
    for sleutel, waarden in (genormeerd or {}).items():
        if isinstance(waarden, dict) and waarden.get("latent") is not None:
            resultaat[sleutel] = waarden["latent"]
    return resultaat


def _verzamel_scores(tokens, taken_refs: list) -> dict:
    """
    Vraagt per bewaarde assignment-uuid de scores op en voegt ze samen.

    Samenvoegen is nodig omdat de score-respons cumulatief per KANDIDAAT is en niet per
    taak: geverifieerd 2026-08-18 gaf de Blocks-taak alleen de blocks-node, terwijl de
    Rally-taak zowel rally als blocks teruggaf. Wie alleen de laatste taak uitleest,
    mist scores van een kandidaat die maar één game heeft afgerond.

    Returns:
        {'blocks': {sleutel: float}, 'rally': {...},
         'levels_voltooid': int|None, 'levels_perfect': int|None}
    """
    if isinstance(tokens, str):
        tokens = [tokens]

    resultaat = {game: {} for game in GAMES}
    resultaat["levels_voltooid"] = None
    resultaat["levels_perfect"] = None

    for ref in taken_refs:
        assignment = ixly_api.haal_assignment(tokens[0], ref.get("assignment_uuid", ""))
        if not assignment:
            continue

        soort, taak_uuid = ixly_api.taakverwijzing(assignment)
        if not soort:
            continue

        score = ixly_api.haal_taak_score(tokens, soort, taak_uuid)
        genormeerd = score.get("normed", {})
        for game in GAMES:
            if genormeerd.get(game):
                resultaat[game].update(_plat(genormeerd[game]))

        if score.get("blocks_levels_completed") is not None:
            resultaat["levels_voltooid"] = score["blocks_levels_completed"]
        if score.get("blocks_levels_perfect") is not None:
            resultaat["levels_perfect"] = score["blocks_levels_perfect"]

    return resultaat


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Ixly Scores gestart.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Ongeldige JSON in request body.", status_code=400)

    deelnemers = body.get("deelnemers")
    if not deelnemers or not isinstance(deelnemers, list):
        return func.HttpResponse(
            json.dumps({"fout": "deelnemers ontbreekt of is geen lijst."}),
            mimetype="application/json",
            status_code=400,
        )

    if len(deelnemers) > MAX_DEELNEMERS_PER_AANROEP:
        return func.HttpResponse(
            json.dumps({"fout": f"Maximaal {MAX_DEELNEMERS_PER_AANROEP} deelnemers per aanroep."}),
            mimetype="application/json",
            status_code=400,
        )

    try:
        tokens = ixly_api.haal_alle_tokens()
    except requests.HTTPError as e:
        logging.error(f"Ixly token fout: {e.response.status_code} — {e.response.text}")
        return func.HttpResponse(
            json.dumps({"fout": "Kon geen Ixly-token ophalen."}),
            mimetype="application/json",
            status_code=502,
        )

    resultaten = {}
    for deelnemer in deelnemers:
        order_id = str(deelnemer.get("order_id", ""))
        taken_refs = deelnemer.get("taken", [])
        if not order_id or not taken_refs:
            continue
        try:
            resultaten[order_id] = _verzamel_scores(tokens, taken_refs)
        except requests.HTTPError as e:
            # Eén stukke deelnemer blokkeert de rest niet.
            logging.error(f"Order {order_id}: Ixly-fout {e.response.status_code}")
            resultaten[order_id] = {"fout": f"Ixly-fout {e.response.status_code}"}

    logging.info(f"Scores opgehaald voor {len(resultaten)} deelnemers.")
    return func.HttpResponse(
        json.dumps({"resultaten": resultaten}),
        mimetype="application/json",
        status_code=200,
    )
