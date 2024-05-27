import {
  ChevronDownIcon,
  ChevronRightIcon,
  Chip,
  Icon,
  MagnifyingGlassStrokeIcon,
  Spinner,
  Tooltip,
} from "@dust-tt/sparkle";
import type { WebsearchActionType, WebsearchResultType } from "@dust-tt/types";
import { Transition } from "@headlessui/react";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { trimText } from "@app/lib/utils";

export default function WebsearchAction({
  websearchAction,
}: {
  websearchAction: WebsearchActionType;
}) {
  const { query } = websearchAction;

  const [resultsListVisible, setResultsListVisible] = useState(false);

  const { results } = websearchAction.output || { results: [] };
  console;

  return (
    <>
      <div className="flex flex-row items-center gap-2 pb-2">
        <div className="text-xs font-bold text-element-600">
          Searching&nbsp;Google&nbsp;for:
        </div>
        <Chip.List isWrapping={true}>
          <Tooltip label={`Query used for google search: ${query}`}>
            <Chip color="slate" label={trimText(query)} />
          </Tooltip>
        </Chip.List>
      </div>
      <div className="grid grid-cols-[auto,1fr] gap-2">
        <div className="grid-cols-auto grid items-center">
          {!websearchAction.output ? (
            <div>
              <div className="pb-2 text-xs font-bold text-element-600">
                Searching...
              </div>
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="text-xs font-bold text-element-600">
              <span>Results:</span>
            </div>
          )}
        </div>
        <div className="row-span-1 select-none">
          {websearchAction.output && (
            <div
              onClick={() => setResultsListVisible(!resultsListVisible)}
              className="cursor-pointer"
            >
              <Chip color="purple">
                {results.length > 0
                  ? SearchResultsInfo(results)
                  : "No results found"}
                <Icon
                  visual={
                    resultsListVisible ? ChevronDownIcon : ChevronRightIcon
                  }
                  size="xs"
                />
              </Chip>
            </div>
          )}
        </div>
        <div className="col-start-2 row-span-1">
          {!!results.length && (
            <Transition
              show={resultsListVisible}
              enter="transition ease-out duration-200 transform"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition ease-in duration-75 transform"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <ul className="ml-2 flex flex-col gap-y-2">
                {results.map((result, i) => {
                  return (
                    <li key={i} className="flex flex-col gap-1">
                      <Tooltip label={result.snippet}>
                        <a
                          rel="noopener noreferrer"
                          href={result.link}
                          className="front-bold flex items-center text-xs"
                          target="_blank"
                        >
                          <Icon
                            visual={ExternalLinkIcon}
                            size="xs"
                            className="mr-1 inline-block"
                          />
                          <div className="text-action-800">{result.title}</div>
                        </a>
                        <div className="flex text-xs text-element-700">
                          <Icon
                            visual={ExternalLinkIcon}
                            size="xs"
                            className="mr-1 inline-block opacity-0"
                          />
                          <div>{trimText(result.snippet, 80)}</div>
                        </div>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </Transition>
          )}
        </div>
      </div>
    </>
  );
}

function SearchResultsInfo(searchResults: WebsearchResultType[]) {
  return (
    <div className="flex flex-row items-center">
      <span>
        <Icon
          visual={MagnifyingGlassStrokeIcon}
          size="sm"
          className="mr-1 inline-block"
        />
        {searchResults.length}&nbsp;results
      </span>
    </div>
  );
}
