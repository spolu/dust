import json
from typing import Any

from requests import post

from dust_cli.request_helper import make_request, get_timezone


def create_message(
    api_key: str, workspace_id: str, message: str, user: str, conversation: str
) -> dict[str, Any]:
    """Creates a new conversation."""
    # TODO: share typing with the API
    return json.loads(
        make_request(
            post,
            f"assistant/conversations/{conversation}/messages",
            api_key=api_key,
            workspace_id=workspace_id,
            body={
                "content": message,
                "context": {
                    # TODO: check how the values here are set and used
                    "timezone": get_timezone(),
                    "profilePictureUrl": "",
                    "email": "",
                    "origin": "slack",  # TODO: this is arbitrary, maybe define a new origin
                    "fullName": "",
                    "username": user,
                },
                "mentions": [{"configurationId": "dust"}],
            },
        ).text
    )
