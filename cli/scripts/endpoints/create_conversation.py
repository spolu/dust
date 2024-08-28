import argparse
import json
import logging

from requests import post

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.request_helper import make_request


def create_conversation(args: argparse.Namespace) -> None:
    """Creates a new conversation."""
    logging.info(
        json.dumps(
            json.loads(
                make_request(
                    post,
                    "assistant/conversations",
                    api_key=args.api_key,
                    workspace_id=args.workspace_id,
                    body={"message": {"content": args.message}},
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


main = run_subcommand(add_create_conversation_args)

if __name__ == "__main__":
    main()
