import json

from requests import get

from dust_cli.request_helper import make_request
from dust_cli.response_parsers import AgentConfiguration


def list_assistants(api_key: str, workspace_id: str) -> list[AgentConfiguration]:
    """Lists the assistants that are available."""
    return [
        AgentConfiguration(**entry)
        for entry in json.loads(
            make_request(
                get,
                "assistant/agent_configurations",
                api_key=api_key,
                workspace_id=workspace_id,
            ).text
        )["agentConfigurations"]
    ]
