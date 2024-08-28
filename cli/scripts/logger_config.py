LOGGING_CONFIG = {
    "level": "DEBUG",
    "fmt": "%(asctime)s %(levelname)-7s %(message)s",
    "field_styles": {
        "levelname": {"color": "black", "bright": True, "bold": True},
        "asctime": {"color": "magenta", "bright": True},
    },
    "level_styles": {
        "debug": {"color": 200, "italic": True, "faint": True},
        "info": {"color": 181, "faint": False},
        "critical": {"color": "red", "bold": True},
        "error": {"color": "red", "bright": True},
        "warning": {"color": "yellow", "bright": True},
    },
}
