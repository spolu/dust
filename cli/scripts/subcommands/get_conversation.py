import argparse
import json
import logging
from dataclasses import asdict

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints.get_conversation import get_conversation


def handle_conversation_retrieval(args: argparse.Namespace) -> None:
    """Retrieves an existing conversation."""
    logging.info(
        json.dumps(
            asdict(
                get_conversation(args.api_key, args.workspace_id, args.conversation)
            ),
            indent=2,
        )
    )


# noinspection PyUnusedLocal
@attached_to(handle_conversation_retrieval)
def add_get_conversation_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that retrieves conversations."""
    parser.add_argument(
        "--conversation",
        "-c",
        type=str,
        required=True,
        help="The ID of the conversation.",
    )


main = run_subcommand(add_get_conversation_args)

if __name__ == "__main__":
    main()
