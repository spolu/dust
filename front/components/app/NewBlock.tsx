import { Button } from "@dust-tt/sparkle";
import type { SpecificationType } from "@dust-tt/types";
import type { BlockType } from "@dust-tt/types";
import { Menu } from "@headlessui/react";
import { PlusIcon } from "@heroicons/react/20/solid";

import { classNames } from "@app/lib/utils";

export default function NewBlock({
  spec,
  disabled,
  onClick,
  direction,
  small,
}: {
  spec: SpecificationType;
  disabled: boolean;
  onClick: (type: BlockType | "map_reduce" | "while_end") => void;
  direction: "up" | "down";
  small: boolean;
}) {
  const containsInput =
    spec.filter((block) => block.type == "input").length > 0;
  const blocks: {
    type: BlockType | "map_reduce" | "while_end";
    typeNames: BlockType[];
    name: string;
    description: string;
  }[] = [
    {
      type: "chat",
      typeNames: ["chat"],
      name: "Interact with a Large Language Model (LLM)",
      description:
        "Query a Large Language Model using a message-based interface.",
    },
    {
      type: "llm",
      typeNames: ["llm"],
      name: "Interact with a Large Language Model (LLM)",
      description:
        "Query a Large Language Model using a message-based interface.",
    },
    {
      type: "data",
      typeNames: ["data"],
      name: "Data array",
      description:
        "Load a dataset and output its elements as an array. Typically used to seed few-shot prompts.",
    },
    {
      type: "code",
      typeNames: ["code"],
      name: "Run Javascript",
      description:
        "Run a snippet of JavaScript to modify, augment, or combine results from other blocks.",
    },
    {
      type: "data_source",
      typeNames: ["data_source"],
      name: "Search a datasource",
      description:
        "Perform semantic search against chunked documents from a DataSource.",
    },
    {
      type: "curl",
      typeNames: ["curl"],
      name: "cURL Request",
      description:
        "Perform an HTTP request to interface with external services.",
    },
    {
      type: "browser",
      typeNames: ["browser"],
      name: "Extract website data",
      description:
        "Download the HTML or text content of page on the web (or a portion of it).",
    },
    {
      type: "search",
      typeNames: ["search"],
      name: "Google Search",
      description:
        "Issue a query to Google so you can feed the results to other blocks.",
    },
    {
      type: "map_reduce",
      typeNames: ["map", "reduce"],
      name: "Map Reduce loop",
      description:
        "Map over an array and execute a sequence of blocks in parallel.",
    },
    {
      type: "while_end",
      typeNames: ["while", "end"],
      name: "While loop",
      description: "Loop over a set of blocks until a condition is met.",
    },
    {
      type: "database_schema",
      typeNames: ["database_schema"],
      name: "Retrieve a database schema",
      description: "Retrieve the schema of a database.",
    },
    {
      type: "database",
      typeNames: ["database"],
      name: "Query a database",
      description:
        "Query a database by executing SQL queries on structured data sources.",
    },
  ];

  blocks.sort((a, b) =>
    a.type.toLowerCase().localeCompare(b.type.toLowerCase())
  );

  // Add input block on top if it doesn't exist.
  if (!containsInput) {
    blocks.splice(0, 0, {
      type: "input",
      typeNames: ["input"],
      name: "Input",
      description:
        "Select a dataset of inputs used for the design your Dust app. Each element in the dataset kicks off a separate parallel execution of the Dust app.",
    });
  }

  return (
    <Menu as="div" className="relative inline-block">
      <div>
        {small ? (
          <Menu.Button
            className={classNames(
              "border-1 inline-flex items-center border-red-200 bg-transparent px-0 py-0 text-sm font-medium leading-6 text-gray-400",
              disabled ? "text-gray-300" : "hover:text-gray-700",
              "focus:outline-none focus:ring-0"
            )}
            disabled={disabled}
          >
            <PlusIcon className="h-4 w-4" />
          </Menu.Button>
        ) : (
          <Menu.Button as="div" disabled={disabled}>
            <Button
              variant="secondary"
              label="Add Block"
              icon={PlusIcon}
              disabled={disabled}
            />
          </Menu.Button>
        )}
      </div>
      <Menu.Items
        className={classNames(
          "absolute z-10 my-2 block w-max rounded-md bg-white shadow ring-1 ring-black ring-opacity-5 focus:outline-none",
          small ? "-right-16" : "",
          direction === "up" ? "bottom-9" : ""
        )}
      >
        {blocks.map((block) => (
          <Menu.Item
            as="div"
            key={block.type}
            onClick={() => {
              if (onClick) {
                onClick(block.type);
              }
            }}
            className="my-1 flex cursor-pointer flex-row flex-nowrap gap-4 bg-white px-0 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            {() => (
              <div className="ml-4 grid max-w-md grid-cols-12 items-center">
                <div className="col-span-4 sm:col-span-3">
                  <div className="flex text-base font-medium text-gray-900">
                    <div
                      className={`mr-1 rounded-md px-1 py-0.5 text-sm font-bold ${
                        block.type === "input" ? "bg-orange-200" : "bg-gray-200"
                      }`}
                    >
                      {block.type}
                    </div>
                  </div>
                </div>
                <div className="col-span-8 pr-2 text-sm text-gray-700 sm:col-span-9 sm:pl-6">
                  <strong>{block.name}</strong>
                  <br />
                  <p className="text-sm">{block.description}</p>
                </div>
              </div>
            )}
          </Menu.Item>
        ))}
      </Menu.Items>
    </Menu>
  );
}
