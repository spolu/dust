from __future__ import annotations

from dataclasses import dataclass, fields
from typing import Optional, Literal, Any

ModelId = int
RoleType = Literal["admin", "builder", "user", "none"]
ConversationVisibility = Literal["unlisted", "workspace", "deleted", "test"]


@dataclass(frozen=True)
class Workspace:
    id: ModelId
    sId: str
    name: str
    role: RoleType
    segmentation: Optional[Literal["interesting"]]
    whiteListedProviders: list | None
    defaultEmbeddingProvider: Any
    flags: list
    ssoEnforced: bool = False


@dataclass
class Conversation:
    id: int
    created: int
    sId: str
    owner: Workspace
    title: Optional[str]
    visibility: ConversationVisibility
    content: list[dict[str, Any]]

    def __post_init__(self):
        """Automatically casts class attributes when possible, which does not cover type generics."""
        for f in fields(self):
            value = getattr(self, f.name)
            try:
                if f.type == "Workspace" and not isinstance(value, Workspace):
                    setattr(self, f.name, Workspace(**value))
            except TypeError:
                pass
