import argparse
from typing import Callable

from .create_conversation import add_create_conversation_args
from .create_message import add_create_message_args
from .get_conversation import add_get_conversation_args
from .list_assistants import add_list_assistants_args

subcommands: dict[str, Callable[[argparse.ArgumentParser], None]] = {
    "create-conversation": add_create_conversation_args,
    "create-message": add_create_message_args,
    "list-assistants": add_list_assistants_args,
    "get-conversation": add_get_conversation_args,
}

__all__ = ["subcommands"]
