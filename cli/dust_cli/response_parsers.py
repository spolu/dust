from __future__ import annotations

import json
from dataclasses import dataclass, fields, asdict
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

    def __str__(self) -> str:
        return json.dumps(asdict(self), indent=2)


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

    def __str__(self) -> str:
        return json.dumps(asdict(self), indent=2)


@dataclass
class Model:
    providerId: str
    modelId: str
    temperature: float

    def __str__(self) -> str:
        return json.dumps(asdict(self), indent=2)


@dataclass
class AgentConfiguration:
    id: int
    sId: str
    version: int
    versionCreatedAt: Optional[int]
    versionAuthorId: Optional[str]
    name: str
    description: str
    instructions: str
    pictureUrl: str
    status: str
    userListStatus: str
    scope: str
    model: Model
    actions: list
    maxStepsPerRun: int
    visualizationEnabled: bool
    templateId: Optional[str]

    def __post_init__(self):
        """Automatically casts class attributes when possible, which does not cover type generics."""
        for f in fields(self):
            value = getattr(self, f.name)
            try:
                if f.type == "Model" and not isinstance(value, Model):
                    setattr(self, f.name, Model(**value))
            except TypeError:
                pass

    def minimal_info(self) -> str:
        return f"{self.name} ({self.model.modelId}): {self.description}"

    def __str__(self) -> str:
        return json.dumps(asdict(self), indent=2)
