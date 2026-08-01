"""
TIJDELIJKE debug-function -- test de exacte (gefixte) PUT-aanroep uit
ixly-aanmelding/_bewaar_ixly_taken vanuit de Function App zelf, met een
neppe assignment-uuid, tegen order 1237. Wordt na gebruik verwijderd.
"""
import json
import logging
import os

import azure.functions as func
import requests

GROVIA_WORDPRESS_URL       = os.environ.get("GROVIA_WORDPRESS_URL", "")
GROVIA_WOO_CONSUMER_KEY    = os.environ.get("GROVIA_WOO_CONSUMER_KEY", "")
GROVIA_WOO_CONSUMER_SECRET = os.environ.get("GROVIA_WOO_CONSUMER_SECRET", "")


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Debug Woo Write gestart.")

    resultaat = {}
    order_id = "1237"
    waarde = "Debug Game:00000000-0000-0000-0000-000000000000"

    try:
        response = requests.put(
            f"{GROVIA_WORDPRESS_URL}/wp-json/wc/v3/orders/{order_id}",
            auth=(GROVIA_WOO_CONSUMER_KEY, GROVIA_WOO_CONSUMER_SECRET),
            json={"meta_data": [{"key": "_grovia_ixly_taken_debugtest", "value": waarde}]},
            headers={"User-Agent": "GroviaAutomations-IxlyAanmelding/1.0"},
            timeout=15,
        )
        resultaat["status_code"] = response.status_code
        resultaat["response_body"] = response.text[:1000]
    except Exception as e:
        resultaat["exception"] = f"{type(e).__name__}: {e}"

    return func.HttpResponse(
        json.dumps(resultaat, indent=2),
        mimetype="application/json",
        status_code=200,
    )
