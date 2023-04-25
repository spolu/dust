import {
  Client,
  collectPaginatedAPI,
  isFullBlock,
  isFullPage,
  iteratePaginatedAPI,
} from "@notionhq/client";
import {
  BlockObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

import logger from "@connectors/logger/logger";

// notion SDK types
type PageObjectProperties = PageObjectResponse["properties"];
type PropertyKeys = keyof PageObjectProperties;
type PropertyTypes = PageObjectProperties[PropertyKeys]["type"];

// Extractor types
export interface ParsedPage {
  id: string;
  url: string;
  properties: ParsedProperty[];
  blocks: ParsedBlock[];
  rendered: string;
}
type ParsedProperty = {
  key: string;
  id: string;
  type: PropertyTypes;
  text: string | null;
};
type ParsedBlock = {
  id: string;
  type: BlockObjectResponse["type"];
  text: string | null;
};

/**
 * @param notionAccessToken the access token to use to access the Notion API
 * @param sinceTs a millisecond timestamp representing the minimum last edited time of
 * pages to return. If null, all pages will be returned.
 * @returns a promise that resolves to an array of page IDs
 */
export async function getPagesEditedSince(
  notionAccessToken: string,
  sinceTs: number | null
): Promise<string[]> {
  const notionClient = new Client({ auth: notionAccessToken });

  const editedPages: string[] = [];
  for await (const page of iteratePaginatedAPI(notionClient.search, {
    filter: {
      property: "object",
      value: "page",
    },
    sort: {
      timestamp: "last_edited_time",
      direction: "descending",
    },
  })) {
    if (page.object == "page") {
      if (isFullPage(page)) {
        const lastEditedTime = new Date(page.last_edited_time).getTime();
        if (sinceTs && lastEditedTime < sinceTs) {
          break;
        }
        editedPages.push(page.id);
      }
    }
  }
  return editedPages;
}

export async function getParsedPage(
  notionAccessToken: string,
  pageId: string
): Promise<ParsedPage> {
  const notionClient = new Client({ auth: notionAccessToken });

  const page = await notionClient.pages.retrieve({ page_id: pageId });

  if (!isFullPage(page)) {
    throw new Error("Page is not a full page");
  }

  logger.info(`Parsing page ${page.url} (${page.id}))`);
  const properties = Object.entries(page.properties).map(([key, value]) => ({
    key,
    id: value.id,
    type: value.type,
    text: parsePropertyText(value),
  }));

  const blocks = await collectPaginatedAPI(notionClient.blocks.children.list, {
    block_id: page.id,
  });

  let parsedBlocks: ParsedBlock[] = [];
  for (const block of blocks) {
    if (isFullBlock(block)) {
      parsedBlocks = parsedBlocks.concat(
        await parsePageBlock(block, notionClient)
      );
    }
  }

  let renderedPage = "";
  for (const property of properties) {
    if (!property.text) continue;
    renderedPage += `$${property.key}: ${property.text}\n`;
  }

  renderedPage += "\n";
  for (const parsedBlock of parsedBlocks) {
    if (!parsedBlock.text) continue;
    renderedPage += `${parsedBlock.text}\n`;
  }

  return {
    id: page.id,
    url: page.url,
    properties,
    blocks: parsedBlocks,
    rendered: renderedPage,
  };
}

export async function validateAccessToken(notionAccessToken: string) {
  const notionClient = new Client({ auth: notionAccessToken });
  try {
    await notionClient.search({ page_size: 1 });
  } catch (e) {
    return false;
  }
  return true;
}

function parsePropertyText(
  property: PageObjectProperties[PropertyKeys]
): string | null {
  switch (property.type) {
    case "number":
      return property.number?.toString() || null;
    case "url":
      return property.url || null;
    case "select":
      return property.select?.name || null;
    case "multi_select":
      return property.multi_select.length > 0
        ? property.multi_select.map((select) => select.name).join(", ")
        : null;
    case "status":
      return property.status?.name || null;
    case "date":
      if (property.date?.start && property.date?.end) {
        return `${property.date.start} - ${property.date.end}`;
      }
      return property.date?.start || null;
    case "email":
      return property.email || null;
    case "phone_number":
      return property.phone_number || null;
    case "checkbox":
      return property.checkbox ? "Yes" : "No";
    case "files":
      return property.files.length > 0
        ? property.files
            .map((f) => ({
              name: f.name,
              url: "external" in f ? f.external.url : f.file.url,
            }))
            .map(({ name, url }) => `[${name}](${url})`)
            .join(", ")
        : null;
    case "created_by":
      return "name" in property.created_by ? property.created_by?.name : null;
    case "created_time":
      return property.created_time;
    case "last_edited_by":
      return "name" in property.last_edited_by
        ? property.last_edited_by?.name
        : null;
    case "last_edited_time":
      return property.last_edited_time;
    case "title":
      return property.title.map((t) => t.plain_text).join(" ");
    case "rich_text":
      return property.rich_text.map((t) => t.plain_text).join(" ");
    case "people":
      return property.people.length > 0
        ? property.people.map((p) => ("name" in p ? p.name : p.id)).join(", ")
        : null;
    case "relation":
    case "rollup":
    case "formula":
    // @ts-expect-error missing from Notion package
    // eslint-disable-next-line no-fallthrough
    case "verification":
      return null;
    default:
      // `property` here is `never`
      ((property: never) => {
        logger.warn(
          { property_type: (property as { type: string }).type },
          `Unknown property type`
        );
      })(property);
      return null;
  }
}

async function parsePageBlock(
  block: BlockObjectResponse,
  notionClient: Client
): Promise<ParsedBlock[]> {
  function parseRichText(text: RichTextItemResponse[]): string {
    const parsed = text.map((t) => t.plain_text).join(" ");
    return parsed;
  }

  function renderUrl(url: string, caption?: string | null): string {
    if (caption) {
      return `[${caption}](${url})`;
    }
    return url;
  }

  function renderFile(
    fileContainer: (
      | { file: { url: string } }
      | { external: { url: string } }
    ) & {
      caption: RichTextItemResponse[];
    }
  ): string {
    const fileUrl =
      "external" in fileContainer
        ? fileContainer.external.url
        : fileContainer.file.url;
    const caption = parseRichText(fileContainer.caption);
    const fileText =
      caption && caption.length
        ? `[${parseRichText(fileContainer.caption)}](${fileUrl})`
        : fileUrl;
    return fileText;
  }

  function indentBlocks(blocks: ParsedBlock[]): ParsedBlock[] {
    const indentedBlocks: ParsedBlock[] = [];
    for (const { text, ...rest } of blocks) {
      const indentedText = text ? `- ${text}` : null;
      indentedBlocks.push({
        ...rest,
        text: indentedText,
      });
    }
    return indentedBlocks;
  }

  async function withPotentialChildren(
    parsedBlock: ParsedBlock,
    block: BlockObjectResponse
  ): Promise<ParsedBlock[]> {
    const parsedBlocks = [parsedBlock];
    if (!block.has_children) {
      return parsedBlocks;
    }

    const children = await collectPaginatedAPI(
      notionClient.blocks.children.list,
      {
        block_id: block.id,
      }
    );
    const parsedChildren = (
      await Promise.all(
        children.map(async (child) => {
          if (isFullBlock(child)) {
            return parsePageBlock(child, notionClient);
          }
          return [];
        })
      )
    ).flat();

    return parsedBlocks.concat(indentBlocks(parsedChildren));
  }

  const commonFields = {
    id: block.id,
    type: block.type,
  };

  const NULL_BLOCK = {
    ...commonFields,
    text: null,
  };

  switch (block.type) {
    case "column":
    case "breadcrumb":
    case "column_list":
    case "link_to_page":
    case "divider":
    case "synced_block":
    case "table_of_contents":
    case "unsupported":
      // TODO: check if we want that ?
      return [NULL_BLOCK];

    case "equation":
      return [
        {
          ...commonFields,
          text: block.equation.expression,
        },
      ];

    case "link_preview":
      return [
        {
          ...commonFields,
          text: block.link_preview.url,
        },
      ];

    case "table_row":
      return [
        {
          ...commonFields,
          text: block.table_row.cells.map(parseRichText).join(" | "),
        },
      ];

    case "code":
      return [
        {
          ...commonFields,
          text: `\`\`\`${block.code.language} ${parseRichText(
            block.code.rich_text
          )} \`\`\``,
        },
      ];

    // URL blocks
    case "bookmark":
      return [
        {
          ...commonFields,
          text: block.bookmark
            ? renderUrl(
                block.bookmark.url,
                parseRichText(block.bookmark.caption)
              )
            : null,
        },
      ];
    case "embed":
      return [
        {
          ...commonFields,
          text: renderUrl(block.embed.url, parseRichText(block.embed.caption)),
        },
      ];

    // File blocks
    case "file":
      return [
        {
          ...commonFields,
          text: renderFile(block.file),
        },
      ];
    case "image":
      return [
        {
          ...commonFields,
          text: renderFile(block.image),
        },
      ];
    case "pdf":
      return [
        {
          ...commonFields,
          text: renderFile(block.pdf),
        },
      ];
    case "video":
      return [
        {
          ...commonFields,
          text: renderFile(block.video),
        },
      ];

    case "audio":
      return [
        {
          ...commonFields,
          text: renderFile(block.audio),
        },
      ];

    // blocks that may have child blocks:
    case "table":
      return withPotentialChildren(NULL_BLOCK, block);

    case "bulleted_list_item":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `* ${parseRichText(block.bulleted_list_item.rich_text)}`,
        },
        block
      );
    case "callout":
      return withPotentialChildren(
        {
          ...commonFields,
          text: parseRichText(block.callout.rich_text),
        },
        block
      );
    case "heading_1":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `# ${parseRichText(block.heading_1.rich_text).replace(
            "\n",
            " "
          )}`,
        },
        block
      );

    case "heading_2":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `## ${parseRichText(block.heading_2.rich_text).replace(
            "\n",
            " "
          )}`,
        },
        block
      );
    case "heading_3":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `### ${parseRichText(block.heading_3.rich_text).replace(
            "\n",
            " "
          )}`,
        },
        block
      );
    case "numbered_list_item":
      return withPotentialChildren(
        {
          ...commonFields,
          text: parseRichText(block.numbered_list_item.rich_text),
        },
        block
      );
    case "paragraph":
      return withPotentialChildren(
        {
          ...commonFields,
          text: parseRichText(block.paragraph.rich_text),
        },
        block
      );
    case "quote":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `> ${parseRichText(block.quote.rich_text)}`,
        },
        block
      );
    case "template":
      return withPotentialChildren(
        {
          ...commonFields,
          text: parseRichText(block.template.rich_text),
        },
        block
      );
    case "to_do":
      return withPotentialChildren(
        {
          ...commonFields,
          text: `[${block.to_do.checked ? "x" : " "}] ${parseRichText(
            block.to_do.rich_text
          )}`,
        },
        block
      );

    case "toggle":
      return withPotentialChildren(
        {
          ...commonFields,
          text: parseRichText(block.toggle.rich_text),
        },
        block
      );

    // blocks that technically have children but we don't want to recursively parse them
    // because the search endpoint returns them already
    case "child_database":
      return [
        {
          ...commonFields,
          text: block.child_database.title,
        },
      ];
    case "child_page":
      return [
        {
          ...commonFields,
          text: block.child_page.title,
        },
      ];

    default:
      // `block` here is `never`
      ((block: never) => {
        logger.warn(
          { type: (block as { type: string }).type },
          "Unknown block type"
        );
      })(block);
      return [NULL_BLOCK];
  }
}
