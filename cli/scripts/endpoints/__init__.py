import argparse
from typing import Callable

from .create_conversation import add_create_conversation_args

endpoints: dict[str, Callable[[argparse.ArgumentParser], None]] = {
}

__all__ = ["endpoints"]
