<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
import { Button } from "@dust-tt/sparkle";
import { Checkbox } from "@dust-tt/sparkle";
import { Page } from "@dust-tt/sparkle";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@dust-tt/sparkle";
import { Spinner } from "@dust-tt/sparkle";
import { TextArea } from "@dust-tt/sparkle";
import { Tooltip } from "@dust-tt/sparkle";
<<<<<<< Updated upstream
=======
import {
  Button,
  Checkbox,
  Page,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  Spinner,
  TextArea,
  Tooltip,
} from "@dust-tt/sparkle";
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import { HandThumbDownIcon, HandThumbUpIcon } from "@dust-tt/sparkle";
import React, { useCallback, useEffect, useRef } from "react";

export type ThumbReaction = "up" | "down";

export type FeedbackType = {
  thumb: ThumbReaction;
  feedbackContent: string | null;
  isConversationShared: boolean;
};

export interface FeedbackSelectorProps {
  feedback: FeedbackType | null;
  onSubmitThumb: (
    p: FeedbackType & {
      shouldRemoveExistingFeedback: boolean;
    }
  ) => Promise<void>;
  isSubmittingThumb: boolean;
  getPopoverInfo?: () => JSX.Element | null;
}

export function FeedbackSelector({
  feedback,
  onSubmitThumb,
  isSubmittingThumb,
  getPopoverInfo,
}: FeedbackSelectorProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [localFeedbackContent, setLocalFeedbackContent] = React.useState<
    string | null
  >(null);
  const [popOverInfo, setPopoverInfo] = React.useState<JSX.Element | null>(
    null
  );
  const [isConversationShared, setIsConversationShared] = React.useState(
    feedback?.isConversationShared ?? false
  );
  // This is required to adjust the content of the popover even when feedback is null.
  const [lastSelectedThumb, setLastSelectedThumb] =
    React.useState<ThumbReaction | null>(feedback?.thumb ?? null);

  useEffect(() => {
    if (isPopoverOpen) {
      if (getPopoverInfo) {
        setPopoverInfo(getPopoverInfo());
      }
      if (feedback?.thumb === lastSelectedThumb) {
        setLocalFeedbackContent(feedback?.feedbackContent ?? null);
      }
    }
  }, [
    isPopoverOpen,
    feedback?.feedbackContent,
    getPopoverInfo,
    lastSelectedThumb,
  ]);

  const selectThumb = useCallback(
    async (thumb: ThumbReaction) => {
      // Whether to remove the thumb reaction
      const shouldRemoveExistingFeedback = feedback?.thumb === thumb;
      setIsPopoverOpen(!shouldRemoveExistingFeedback);
      setLastSelectedThumb(shouldRemoveExistingFeedback ? null : thumb);

      // Checkbox ticked by default only for new thumbs down
      setIsConversationShared(thumb === "down");

      // We enforce written feedback for thumbs down.
      // -> Not saving the reaction until then.
      if (thumb === "down" && !shouldRemoveExistingFeedback) {
        return;
      }

      await onSubmitThumb({
        feedbackContent: localFeedbackContent,
        thumb,
        shouldRemoveExistingFeedback,
        // The sharing option was never displayed so far -> Opt out of sharing.
        isConversationShared: false,
      });
    },
    [feedback?.thumb, localFeedbackContent, onSubmitThumb, isConversationShared]
  );

  const handleThumbUp = useCallback(async () => {
    await selectThumb("up");
  }, [selectThumb]);

  const handleThumbDown = useCallback(async () => {
    await selectThumb("down");
  }, [selectThumb]);

  const handleTextAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalFeedbackContent(e.target.value);
    },
    []
  );

  const closePopover = useCallback(() => {
    setIsPopoverOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsPopoverOpen(false);
    if (lastSelectedThumb) {
      await onSubmitThumb({
        thumb: lastSelectedThumb,
        shouldRemoveExistingFeedback: false,
        feedbackContent: localFeedbackContent,
        isConversationShared,
      });
      setLocalFeedbackContent(null);
    }
  }, [
    onSubmitThumb,
    localFeedbackContent,
    isConversationShared,
    lastSelectedThumb,
  ]);

  return (
    <div ref={containerRef} className="flex items-center">
      <PopoverRoot open={isPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <Tooltip
              label="I found this helpful"
              trigger={
                <Button
                  variant={feedback?.thumb === "up" ? "primary" : "ghost"}
                  size="xs"
                  disabled={isSubmittingThumb}
                  onClick={handleThumbUp}
                  icon={HandThumbUpIcon}
                  className={
                    feedback?.thumb === "up"
                      ? ""
<<<<<<< Updated upstream
                      : "[&_svg]:s-text-muted-foreground"
=======
                      : "[&_svg]:text-muted-foreground"
>>>>>>> Stashed changes
                  }
                />
              }
            />
            <Tooltip
              label="Report an issue with this answer"
              trigger={
                <Button
                  variant={feedback?.thumb === "down" ? "primary" : "ghost"}
                  size="xs"
                  disabled={isSubmittingThumb}
                  onClick={handleThumbDown}
                  icon={HandThumbDownIcon}
                  className={
                    feedback?.thumb === "down"
                      ? ""
<<<<<<< Updated upstream
                      : "[&_svg]:s-text-muted-foreground"
=======
                      : "[&_svg]:text-muted-foreground"
>>>>>>> Stashed changes
                  }
                />
              }
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          fullWidth={true}
          onInteractOutside={closePopover}
          onEscapeKeyDown={closePopover}
        >
          {isSubmittingThumb ? (
            <div className="m-3 flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="w-80 p-4">
              <Page.H variant="h6">
                {lastSelectedThumb === "up"
                  ? "🎉 Glad you liked it! Tell us more?"
                  : "🫠 Help make the answers better!"}
              </Page.H>
              <TextArea
                placeholder={
                  lastSelectedThumb === "up"
                    ? "What did you like?"
                    : "Tell us what went wrong so we can make this assistant better."
                }
                className="mb-4 mt-4"
                rows={3}
                value={localFeedbackContent ?? ""}
                onChange={handleTextAreaChange}
              />

              {popOverInfo}
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  checked={isConversationShared}
                  onCheckedChange={(value) => {
                    setIsConversationShared(!!value);
                  }}
                />
                <Page.P variant="secondary">
                  By clicking, you accept to share your full conversation
                </Page.P>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="primary"
                  label="Submit feedback"
                  onClick={handleSubmit}
                  disabled={
                    !localFeedbackContent ||
                    localFeedbackContent.trim() === "" ||
                    isSubmittingThumb
                  }
                />
              </div>
            </div>
          )}
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
