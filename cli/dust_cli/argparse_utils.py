import argparse
from functools import wraps
from typing import Callable

ParserFunction = Callable[[argparse.ArgumentParser], None]


def attached_to(
    func: Callable[[argparse.Namespace], None]
) -> Callable[[ParserFunction], ParserFunction]:
    """Attaches a parser function to a function that will be called through args.func(args)."""

    def attached_to_func(parser_func: ParserFunction) -> ParserFunction:
        """Decorator function that returns a function inheriting from the docstrings of func."""

        @wraps(func)
        def inner_func(parser: argparse.ArgumentParser) -> None:
            parser.description = func.__doc__
            parser_func(parser)
            parser.set_defaults(func=func)

        return inner_func

    return attached_to_func


def run_entry_point(parser_function: ParserFunction) -> Callable[[], None]:
    @wraps(parser_function)
    def inner_func() -> None:
        parser_function((parser := argparse.ArgumentParser(parser_function.__doc__)))
        (args := parser.parse_args()).func(args)

    return inner_func
