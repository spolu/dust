import logging
import os
from typing import Any

import requests


def make_request(
    endpoint: str, api_key: str, workspace_id: str, body: dict[str, Any]
) -> requests.Response:
    """Makes a request to the Dust API."""
    # TODO: add basic logging here
    is_dev = bool(os.environ["DUST_CLI_DEV"])
    base_url = f"{'http://localhost:300' if is_dev else 'https://dust.tt'}/api/v1/w"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"bearer {api_key}",
    }

    response = requests.post(
        f"{base_url}/{workspace_id}/{endpoint.strip('/')}", json=body, headers=headers
    )
    return handle_common_error_codes(response)


def handle_common_error_codes(response: requests.Response) -> requests.Response:
    # TODO: add basic logging here
    if response.status_code == 200:
        return response
    if response.status_code == 401:
        logging.error("Unauthorized access, please check your API key.")
        raise ValueError(response.content.decode())
    return response
