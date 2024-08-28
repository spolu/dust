import logging
import os
from typing import Any, Optional, Callable

import requests


def make_request(
    verb: Callable[..., requests.Response],
    endpoint: str,
    api_key: str,
    workspace_id: str,
    body: Optional[dict[str, Any]] = None,
) -> requests.Response:
    """Makes a request to the Dust API."""
    # TODO: add basic logging here
    is_dev = bool(os.environ.get("DUST_CLI_DEV"))
    base_url = f"{'http://localhost:3000' if is_dev else 'https://dust.tt'}/api/v1/w"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {api_key}",
    }

    if body is not None:
        response = verb(
            f"{base_url}/{workspace_id}/{endpoint.strip('/')}",
            json=body,
            headers=headers,
        )
    else:
        response = verb(
            f"{base_url}/{workspace_id}/{endpoint.strip('/')}", headers=headers
        )
    return handle_common_error_codes(response)


def handle_common_error_codes(response: requests.Response) -> requests.Response:
    # TODO: add basic logging here
    if response.status_code == 200:
        return response
    if response.status_code == 401:
        logging.error("Unauthorized access, please check your API key.")
        raise ValueError(response.text)
    if response.status_code == 404:
        logging.error("Workspace not found, please check your Workspace ID.")
        raise ValueError(response.text)
    if response.status_code == 405:
        logging.error("Method not supported.")
        raise ValueError(response.text)
    return response
