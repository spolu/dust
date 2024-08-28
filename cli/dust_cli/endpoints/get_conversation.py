import json
from typing import Any

from requests import get

from dust_cli.request_helper import make_request


def get_conversation(
    api_key: str, workspace_id: str, conversation: str
) -> dict[str, Any]:
    """Makes a request that a retrieves a conversation."""
    return json.loads(
        make_request(
            get,
            f"assistant/conversations/{conversation}",
            api_key=api_key,
            workspace_id=workspace_id,
        ).text
    )
