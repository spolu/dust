import argparse
import json
import logging

from requests import get

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.request_helper import make_request


def list_assistants(args: argparse.Namespace) -> None:
    """Lists the assistants that are available."""
    logging.info(
        json.dumps(
            json.loads(
                make_request(
                    get,
                    "assistant/agent_configurations",
                    api_key=args.api_key,
                    workspace_id=args.workspace_id,
                ).text
            ),
            indent=2,
        )
    )


# noinspection PyUnusedLocal
@attached_to(list_assistants)
def add_list_assistants_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the endpoint that lists assistants."""
    pass


main = run_subcommand(add_list_assistants_args)

if __name__ == "__main__":
    main()
