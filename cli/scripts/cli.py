import argparse
import logging
import os
from typing import Optional

import argcomplete
import coloredlogs

from dust_cli import __version__
from scripts.endpoints import endpoints
from scripts.logger_config import LOGGING_CONFIG


def get_parser() -> argparse.ArgumentParser:
    """Parses the command line arguments and produces a help message triggered with --help or -h."""
    parser = argparse.ArgumentParser(description="Dust CLI.")
    parser.add_argument(
        "--api-key",
        "-k",
        type=str,
        default=os.environ["DUST_API_KEY"],
        help="Key used to authenticate with the Dust API.",
    )
    parser.add_argument(
        "--workspace-id",
        "-w",
        type=str,
        default=os.environ["DUST_API_KEY"],
        help="Key used to authenticate with the Dust API.",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose.")
    parser.add_argument("--dev", action="store_true", help="Run in development mode.")

    subparsers = parser.add_subparsers(
        title="Endpoints",
        description="Each subcommand has its own help message, check them out!",
        required=True,
    )

    for subcommand, set_subparser in endpoints.items():
        set_subparser(subparsers.add_parser(subcommand, help=set_subparser.__doc__))

    parser_version = subparsers.add_parser("version", help="Get current version.")
    parser_version.set_defaults(func=lambda args: logging.info(__version__))
    argcomplete.autocomplete(parser)

    return parser


def main(args: Optional[argparse.Namespace] = None) -> int:
    args = args or get_parser().parse_args()
    coloredlogs.install(**LOGGING_CONFIG)
    if args.api_key is None:
        raise ValueError("No API key provided.")
    if args.dev:
        os.environ["DUST_CLI_DEV"] = "True"

    if hasattr(args, "verbose") and not args.verbose:
        coloredlogs.set_level(logging.INFO)

    if hasattr(args, "func"):
        args.func(args)
    else:
        get_parser().print_help()

    return 0


if __name__ == "__main__":
    # returning an exit code to enable the use from within any kind of task that would make use of it (e.g. pipeline)
    raise SystemExit(main())
