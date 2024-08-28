import json

from requests import post

from dust_cli.request_helper import make_request, get_timezone
from dust_cli.response_parsers import Conversation


def create_conversation_with_message(
    api_key: str, workspace_id: str, message: str, user: str, assistant: str = "helper"
) -> Conversation:
    """Makes a request that creates a new conversation."""
    return Conversation(
        **json.loads(
            make_request(
                post,
                "assistant/conversations",
                api_key=api_key,
                workspace_id=workspace_id,
                body={
                    "title": None,
                    "visibility": "workspace",
                    "message": {
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
                        "mentions": [{"configurationId": assistant}],
                    },
                    "contentFragments": [],
                },
            ).text
        )
    )


def create_conversation(api_key: str, workspace_id: str) -> Conversation:
    """Makes a request that creates a new conversation."""
    return Conversation(
        **json.loads(
            make_request(
                post,
                "assistant/conversations",
                api_key=api_key,
                workspace_id=workspace_id,
                body={
                    "title": None,
                    "visibility": "workspace",
                    "contentFragments": [],
                },
            ).text
        )["conversation"]
    )
