import argparse
import json
import logging
from dataclasses import asdict

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints import (
    create_conversation_with_message,
    create_conversation,
)


def handle_conversation_creation(args: argparse.Namespace) -> None:
    """Creates a new conversation."""
    # TODO: share typing with the API

    logging.info(
        json.dumps(
            asdict(
                create_conversation_with_message(
                    args.api_key, args.workspace_id, args.message, args.user
                )
                if args.message and args.user
                else create_conversation(
                    args.api_key,
                    args.workspace_id,
                )
            ),
            indent=2,
        )
    )


# noinspection PyUnusedLocal
@attached_to(handle_conversation_creation)
def add_create_conversation_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that creates conversations."""
    parser.add_argument("--message", "-m", type=str, help="The content of the message.")
    parser.add_argument("--user", "-u", type=str, help="The name of the user.")


main = run_subcommand(add_create_conversation_args)

if __name__ == "__main__":
    main()
