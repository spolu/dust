import data from "@emoji-mart/data";

import { EmojiData } from "@sparkle/lib/avatar/types";

const EMOJI_URL_REGEXP = /\/emojis\/bg-([^/]*)\/([^/]*)\/([^/.]*)/;

type backgroundColorType = `bg-${string}`;

/**
 * This helper extracts emojis and background color from a Dust url.
 * URL structure is defined as such:
 * https://dust.tt/emojis/bg-{backgroundColor}/{id}/{unified}.
 */
export function getEmojiAndBackgroundFromUrl(url: string) {
  const emojiData: EmojiData = data as EmojiData;

  const match = url.match(EMOJI_URL_REGEXP);
  if (match) {
    const [, backgroundColor, id, unified] = match;

    const emojiUnicodes = Object.values(emojiData.emojis).find(
      (e) => e.id === id
    );
    if (!emojiUnicodes) {
      return null;
    }

    const skinEmoji = emojiUnicodes.skins.find((s) => s.unified === unified);
    if (!skinEmoji) {
      return null;
    }

    const prefixedBackgroundColor: backgroundColorType = `bg-${backgroundColor}`;

    return {
      backgroundColor: prefixedBackgroundColor,
      id,
      unified,
      skinEmoji: skinEmoji.native,
    };
  }

  return null;
}

export function createEmojiAndBackgroundUrlSuffix({
  backgroundColor,
  id,
  unified,
}: {
  backgroundColor: backgroundColorType;
  id: string;
  unified: string;
}) {
  return `emojis/${backgroundColor}/${id}/${unified}`;
}
