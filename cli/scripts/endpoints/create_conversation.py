import argparse
import json
import logging

from requests import post

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.request_helper import make_request, get_timezone


def create_conversation(args: argparse.Namespace) -> None:
    """Creates a new conversation."""
    # TODO: share typing with the API
    logging.info(
        json.dumps(
            json.loads(
                make_request(
                    post,
                    "assistant/conversations",
                    api_key=args.api_key,
                    workspace_id=args.workspace_id,
                    body={
                        "title": None,
                        "visibility": "workspace",
                        "message": {
                            "content": args.message,
                            "context": {
                                # TODO: check how the values here are set and used
                                "timezone": get_timezone(),
                                "profilePictureUrl": "",
                                "email": "",
                                "origin": "slack",  # TODO: this is arbitrary, maybe define a new origin
                                "fullName": "",
                                "username": args.user,
                            },
                            "mentions": [],
                        },
                        "contentFragments": [],
                    },
                ).content.decode()
            ),
            indent=2,
        )
    )


# noinspection PyUnusedLocal
@attached_to(create_conversation)
def add_create_conversation_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that creates conversations."""
    parser.add_argument(
        "--message", "-m", type=str, required=True, help="The content of the message."
    )
    parser.add_argument(
        "--user", "-u", type=str, required=True, help="The name of the user."
    )


main = run_subcommand(add_create_conversation_args)

if __name__ == "__main__":
    main()
