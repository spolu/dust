import type { Meta } from "@storybook/react";
import React from "react";

import { Drive, Github, Notion, Slack } from "@sparkle/logo/platforms";

import {
  Avatar,
  Button,
  Chip,
  Cog6ToothIcon,
  ContextItem,
  Icon,
  PencilSquareIcon,
  RobotIcon,
  SliderToggle,
  TrashIcon,
} from "../index_with_tw_base";

const meta = {
  title: "Components/ContextItem",
  component: ContextItem,
} satisfies Meta<typeof ContextItem>;

export default meta;

export const ListItemExample = () => (
  <div>
    <ContextItem.List>
      <ContextItem.SectionHeader
        title="Connected platforms"
        description="Platforms connected"
      />
      <ContextItem
        title="Notion"
        visual={<ContextItem.Visual visual={Notion} />}
        onClick={() => console.log("clicked item")}
      >
        <ContextItem.Description description="Teamspaces “General” and “Public”, pages “Engineering”, “Team Life”, “Marketing”, “Brand”, “Getting Started at Dust”, “Brand”, “Design”, “Product Decisions”, “Hiring”, “Man" />
      </ContextItem>
      <ContextItem
        title="Drive"
        visual={<ContextItem.Visual visual={Drive} />}
        onClick={() => console.log("clicked")}
      >
        <ContextItem.Description description="Hello you" />
      </ContextItem>

      <ContextItem.SectionHeader
        title="Connected platforms"
        description="Platforms connected"
      />
      <ContextItem
        title="Slack"
        visual={<ContextItem.Visual visual={Slack} />}
        action={
          <Button.List>
            <Button
              icon={TrashIcon}
              variant="secondaryWarning"
              label="Remove"
              labelVisible={false}
            />
            <Button
              variant="secondary"
              label="Edit"
              size="sm"
              icon={PencilSquareIcon}
            />
          </Button.List>
        }
      >
        <ContextItem.Description description="Hello you" />
      </ContextItem>
      <ContextItem
        title="Github"
        subElement={<>By: Stan</>}
        action={<SliderToggle size="xs" />}
        visual={<ContextItem.Visual visual={Github} />}
      >
        <>
          <div className="s-py-2">
            <Chip label="Syncing…" color="amber" size="sm" isBusy />
          </div>
          <ContextItem.Description description="Teamspaces “General” and “Public”, pages “Engineering”, “Team Life”, “Marketing”, “Brand”, “Getting Started at Dust”, “Brand”, “Design”, “Product Decisions”, “Hiring”, “Man" />
        </>
      </ContextItem>
      <ContextItem
        title="@Gpt4"
        action={<SliderToggle size="xs" />}
        visual={
          <Avatar
            visual="https://dust.tt/static/systemavatar/gpt4_avatar_full.png"
            size="sm"
          />
        }
      >
        <ContextItem.Description description="Lats, pricing, history of contacts, contact message" />
      </ContextItem>
      <ContextItem
        title="@SalesFr"
        subElement={<>By: Edouard Wautier, Amira Hadad</>}
        action={
          <Button
            variant="secondary"
            label="Manage"
            size="sm"
            icon={Cog6ToothIcon}
          />
        }
        visual={
          <Avatar
            visual="https://dust.tt/static/droidavatar/Droid_Indigo_4.jpg"
            size="sm"
          />
        }
      >
        <ContextItem.Description description="Lats, pricing, history of contacts, contact message" />
      </ContextItem>
      <ContextItem
        title="@SupportFr"
        subElement={<>By: Edouard Wautier, Amira Hadad</>}
        action={
          <Button
            variant="secondary"
            label="Manage"
            size="sm"
            icon={Cog6ToothIcon}
          />
        }
        visual={
          <Avatar
            visual="https://dust.tt/static/droidavatar/Droid_Pink_4.jpg"
            size="sm"
          />
        }
      >
        <ContextItem.Description description="Lats, pricing, history of contacts, contact message" />
      </ContextItem>
      <ContextItem
        title="@SupportFr"
        subElement={
          <>
            Added by: Edouard Wautier
            <span className="s-mx-2 s-h-3 s-w-0.5 s-bg-element-500" />
            Used by: 3
            <Icon visual={RobotIcon} size="xs" />
          </>
        }
        action={
          <Button
            variant="secondary"
            label="Manage"
            size="sm"
            icon={Cog6ToothIcon}
          />
        }
        visual={
          <Avatar
            visual="https://dust.tt/static/droidavatar/Droid_Pink_4.jpg"
            size="sm"
          />
        }
      >
        <ContextItem.Description description="Lats, pricing, history of contacts, contact message" />
      </ContextItem>
      {undefined}
    </ContextItem.List>
  </div>
);
