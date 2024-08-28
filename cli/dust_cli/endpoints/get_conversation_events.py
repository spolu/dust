from typing import Callable, Any

import requests

from dust_cli.request_helper import stream_request


def stream_conversation_events(
    api_key: str,
    workspace_id: str,
    conversation: str,
    hooks: list[Callable[[requests.Response], Any]],
) -> None:
    """Makes a request that a retrieves the events for a conversation."""
    stream_request(
        f"assistant/conversations/{conversation}/events",
        api_key=api_key,
        workspace_id=workspace_id,
        hooks=hooks,
    )
