import json
from typing import Any

from requests import get

from dust_cli.request_helper import make_request


def list_assistants(api_key: str, workspace_id: str) -> dict[str, Any]:
    """Lists the assistants that are available."""
    return json.loads(
        make_request(
            get,
            "assistant/agent_configurations",
            api_key=api_key,
            workspace_id=workspace_id,
        ).text
    )
