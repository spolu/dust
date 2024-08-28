import argparse
import json
import logging

from dust_cli.argparse_utils import attached_to, run_subcommand
from dust_cli.endpoints import (
    get_conversation,
    list_assistants,
    create_conversation,
    create_message,
)


def select_assistant(args: argparse.Namespace) -> str:
    assistants = list_assistants(args.api_key, args.workspace_id)
    logging.info(f"Found {len(assistants)} assistants:")
    for index, assistant in enumerate(assistants):
        logging.info(f"  - [{index + 1}] {assistant.minimal_info()}")
    selected_index = int(
        input("Please enter the index associated with the agent you wish to select: ")
    )
    selected_assistant = assistants[selected_index - 1]
    logging.info(f"Selected {selected_assistant.name}.\n")
    return selected_assistant.sId


def chat(args: argparse.Namespace) -> None:
    """Creates a new conversation, allows adding messages to it."""
    args.assistant = args.assistant or select_assistant(args)

    conversation = create_conversation(args.api_key, args.workspace_id)
    logging.info("Ask a question or get some @help.")
    logging.debug(f"New conversation created with ID: {conversation.sId}.")
    while (user_input := input(" >> ")) != "exit":
        try:
            create_message(
                api_key=args.api_key,
                workspace_id=args.workspace_id,
                message=user_input,
                user=conversation.owner.name,
                conversation=conversation.sId,
                assistant=args.assistant,
            )
        except KeyboardInterrupt:
            pass


# noinspection PyUnusedLocal
@attached_to(chat)
def add_chat_args(parser: argparse.ArgumentParser) -> None:
    """Adds the arguments specific to the chat subcommand."""
    parser.add_argument("--assistant", type=str, help="The assistant ID.")


main = run_subcommand(add_chat_args)

if __name__ == "__main__":
    main()
