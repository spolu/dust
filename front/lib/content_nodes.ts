import {
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  FolderIcon,
  Square3Stack3DIcon,
} from "@dust-tt/sparkle";
import type { ContentNode, LightContentNode } from "@dust-tt/types";
import { assertNever } from "@dust-tt/types";

export function getVisualForContentNode(node: ContentNode | LightContentNode) {
  switch (node.type) {
    case "channel":
      return ChatBubbleLeftRightIcon;

    case "database":
      return Square3Stack3DIcon;

    case "file":
      return DocumentTextIcon;

    case "folder":
      return FolderIcon;

    default:
      assertNever(node.type);
  }
}
