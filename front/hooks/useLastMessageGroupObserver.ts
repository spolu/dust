import { useEffect } from "react";

import type { MessageWithContentFragmentsType } from "@app/components/assistant/conversation/ConversationViewer";

/**
 * A custom hook to observe when the last message group element becomes visible or not.
 */
export function useLastMessageGroupObserver(
  messages: MessageWithContentFragmentsType[][][]
) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          // Adjust the minHeight based on the intersecting status.
          if (!entry.isIntersecting) {
            target.style.minHeight = "0px";
          }
        });
      },
      { threshold: 0 }
    );

    const element = document.querySelector(".last-message-group");
    if (element) {
      observer.observe(element);
      return () => {
        observer.unobserve(element);
      };
    }
    return () => {
      observer.disconnect();
    };
  }, [messages]); // Reacts to changes in the dependency array.
}
