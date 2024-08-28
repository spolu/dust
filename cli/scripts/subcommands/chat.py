import argparse
import logging

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints.create_conversation import create_conversation
from dust_cli.endpoints.create_message import create_message


def chat(args: argparse.Namespace) -> None:
    """Creates a new conversation, allows adding messages to it."""
    conversation = create_conversation(args.api_key, args.workspace_id)
    logging.info("Hello there!")
    logging.debug(f"New conversation created with ID: {conversation.sId}.")
    while (user_input := input(" >> ")) != "exit":
        try:
            create_message(
                args.api_key,
                args.workspace_id,
                user_input,
                user=conversation.owner.name,
                conversation=conversation.sId,
            )
        except KeyboardInterrupt:
            pass


# noinspection PyUnusedLocal
@attached_to(chat)
def add_chat_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the chat subcommand."""
    pass


main = run_subcommand(add_chat_args)

if __name__ == "__main__":
    main()
