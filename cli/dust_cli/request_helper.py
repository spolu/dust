import logging
import os
from datetime import datetime
from typing import Any, Optional, Callable

import requests
from pytz import all_timezones, timezone


def get_timezone() -> str:
    local_timezone = datetime.now().astimezone().tzinfo
    return next(
        (
            tz
            for tz in all_timezones
            if timezone(tz).localize(datetime.now()).tzinfo == local_timezone
        ),
        "UTC",
    )


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


def stream_request(
    endpoint: str,
    api_key: str,
    workspace_id: str,
    hooks: list[Callable[[requests.Response], Any]],
) -> None:
    """Makes a streaming request to the Dust API."""
    is_dev = bool(os.environ.get("DUST_CLI_DEV"))
    base_url = f"{'http://localhost:3000' if is_dev else 'https://dust.tt'}/api/v1/w"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {api_key}",
    }

    try:
        with requests.get(
            f"{base_url}/{workspace_id}/{endpoint.strip('/')}",
            headers=headers,
            stream=True,
        ) as r:
            for line in r.iter_lines():
                if line:
                    for hook in hooks:
                        hook(line)
    except AttributeError as e:
        logging.debug(e)
        return


def handle_common_error_codes(response: requests.Response) -> requests.Response:
    # TODO: add basic logging here
    if response.status_code == 200:
        return response
    if response.status_code == 401:
        logging.error("Unauthorized access, please check your API key.")
        raise ValueError(response.text)
    if response.status_code == 404:
        raise ValueError(response.text)
    if response.status_code == 405:
        logging.error("Method not supported.")
        raise ValueError(response.text)
    return response
