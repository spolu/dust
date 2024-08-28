import argparse
import json
import logging

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints import list_assistants


def handle_assistants_listing(args: argparse.Namespace) -> None:
    """Lists the assistants that are available."""
    logging.info(
        json.dumps(
            list_assistants(args.api_key, args.workspace_id),
            indent=2,
        )
    )


# noinspection PyUnusedLocal
@attached_to(handle_assistants_listing)
def add_list_assistants_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that lists assistants."""
    pass


main = run_subcommand(add_list_assistants_args)

if __name__ == "__main__":
    main()
