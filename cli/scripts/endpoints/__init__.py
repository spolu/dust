import argparse
from typing import Callable

from .create_conversation import add_create_conversation_args
from .list_assistants import add_list_assistants_args

endpoints: dict[str, Callable[[argparse.ArgumentParser], None]] = {
    "create-conversation": add_create_conversation_args,
    "list-assistants": add_list_assistants_args,
}

__all__ = ["endpoints"]
