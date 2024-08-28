from __future__ import annotations

from dataclasses import dataclass
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


@dataclass(frozen=True)
class Conversation:
    id: int
    created: int
    sId: str
    owner: Workspace
    title: Optional[str]
    visibility: ConversationVisibility
    content: list[dict[str, Any]]
