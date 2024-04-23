import { Avatar } from "@dust-tt/sparkle";
import type { ReactNode } from "react";
import React from "react";

import { H2, H5, P } from "@app/components/home/new/ContentComponents";
import { classNames } from "@app/lib/utils";

interface SolutionSectionProps {
  title: ReactNode;
  content: SolutionSectionBlockProps | SolutionSectionBlockProps[];
}

export const SolutionSection = ({ title, content }: SolutionSectionProps) => {
  const renderBlocks = () => {
    if (Array.isArray(content)) {
      return content.map((block, index) => (
        <SolutionSection.Block key={index} {...block} />
      ));
    } else {
      return <SolutionSection.Block {...content} />;
    }
  };
  return (
    <>
      <H2 className="col-span-12 pb-4 pt-8 text-center text-white lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3">
        {title}
      </H2>
      {renderBlocks()}
    </>
  );
};

const SolutionSectionColor = {
  pink: "from-pink-200 to-pink-300",
  sky: "from-sky-200 to-sky-300",
  emerald: "from-emerald-200 to-emerald-300",
  amber: "from-amber-200 to-amber-300",
};

interface SolutionSectionBlockProps {
  contentBlocks:
    | SolutionSectionContentBlockProps
    | SolutionSectionContentBlockProps[];
  assistantBlocks:
    | SolutionSectionAssistantBlockProps
    | SolutionSectionAssistantBlockProps[];
  color?: "pink" | "sky" | "emerald" | "amber";
  className?: string;
}

SolutionSection.Block = function SolutionSectionBlock({
  contentBlocks,
  assistantBlocks,
  color = "emerald",
  className = "",
}: SolutionSectionBlockProps) {
  const renderContentBlocks = () => {
    if (Array.isArray(contentBlocks)) {
      return contentBlocks.map((block, index) => (
        <SolutionSection.ContentBlock key={index} {...block} />
      ));
    } else {
      return <SolutionSection.ContentBlock {...contentBlocks} />;
    }
  };

  const renderAssistantBlocks = () => {
    if (Array.isArray(assistantBlocks)) {
      return assistantBlocks.map((block, index) => (
        <SolutionSection.AssistantBlock key={index} {...block} />
      ));
    } else {
      return <SolutionSection.AssistantBlock {...assistantBlocks} />;
    }
  };

  return (
    <div
      className={classNames(
        className,
        "my-4 flex flex-col overflow-hidden rounded-[28px] bg-slate-50 sm:my-0",
        Array.isArray(contentBlocks) || Array.isArray(assistantBlocks)
          ? "col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3"
          : "col-span-12 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 xl:col-span-4 xl:col-start-5"
      )}
    >
      <div className="flex grow basis-0 flex-col gap-8 p-8 md:flex-row">
        {renderContentBlocks()}
      </div>
      <div
        className={classNames(
          "flex grow basis-0 flex-col gap-4 border border-slate-800/10 bg-gradient-to-br p-8 pt-6",
          SolutionSectionColor[color]
        )}
      >
        <div className="text-sm uppercase text-slate-800/60">
          {Array.isArray(assistantBlocks)
            ? "The assistants for the job:"
            : "The assistant for the job:"}
        </div>
        <div className="flex grow basis-0 flex-col justify-start gap-8 md:flex-row">
          {renderAssistantBlocks()}
        </div>
      </div>
    </div>
  );
};

interface SolutionSectionContentBlockProps {
  title: ReactNode;
  content: ReactNode;
}
SolutionSection.ContentBlock = function SolutionSectionContentBlock({
  content,
  title,
}: SolutionSectionContentBlockProps) {
  return (
    <div className={classNames("flex grow basis-0 flex-col gap-3")}>
      <H5 className="text-slate-900">{title}</H5>
      <P size="xs" className="max-w-[500px] text-slate-600">
        {content}
      </P>
    </div>
  );
};

interface SolutionSectionAssistantBlockProps {
  name: string;
  description: string;
  emoji: string;
  backgroundColor: string;
}

SolutionSection.AssistantBlock = function SolutionSectionAssistantBlock({
  name,
  description,
  emoji,
  backgroundColor,
}: SolutionSectionAssistantBlockProps) {
  return (
    <div
      className={classNames("flex max-w-[500px] grow basis-0 flex-col gap-2")}
    >
      <Avatar size="xl" emoji={emoji} backgroundColor={backgroundColor} />
      <H5 className="truncate text-slate-900">{name}</H5>
      <P size="xs" className="text-slate-700">
        {description}
      </P>
    </div>
  );
};
