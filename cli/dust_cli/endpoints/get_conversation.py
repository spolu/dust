import json

from requests import get

from dust_cli.request_helper import make_request
from dust_cli.response_parsers import Conversation


def get_conversation(
    api_key: str, workspace_id: str, conversation: str
) -> Conversation:
    """Makes a request that a retrieves a conversation."""
    return Conversation(
        **json.loads(
            make_request(
                get,
                f"assistant/conversations/{conversation}",
                api_key=api_key,
                workspace_id=workspace_id,
            ).text
        )
    )
