import argparse
import json
import logging

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints import create_message


def handle_message_creation(args: argparse.Namespace) -> None:
    """Creates a new conversation."""
    logging.info(
        json.dumps(
            create_message(
                api_key=args.api_key,
                workspace_id=args.workspace_id,
                message=args.message,
                user=args.user,
                conversation=args.conversation,
            ),
            indent=4,
        )
    )


# noinspection PyUnusedLocal
@attached_to(handle_message_creation)
def add_create_message_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that creates messages."""
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
