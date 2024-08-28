import argparse
import json
import logging

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints.create_message import create_message


def handle_message_creation(args: argparse.Namespace) -> None:
    """Creates a new conversation."""
    # TODO: share typing with the API
    logging.info(
        json.dumps(
            create_message(
                args.api_key,
                args.workspace_id,
                args.message,
                args.user,
                args.conversation,
            ),
            indent=4,
        )
    )


# noinspection PyUnusedLocal
@attached_to(handle_message_creation)
def add_create_message_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that creates conversations."""
    parser.add_argument(
        "--message", "-m", type=str, required=True, help="The content of the message."
    )
    parser.add_argument(
        "--user", "-u", type=str, required=True, help="The name of the user."
    )
    parser.add_argument(
        "--conversation",
        "-c",
        type=str,
        required=True,
        help="The ID of the conversation.",
    )


main = run_subcommand(add_create_message_args)

if __name__ == "__main__":
    main()
