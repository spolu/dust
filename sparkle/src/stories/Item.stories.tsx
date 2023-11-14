import type { Meta } from "@storybook/react";
import React from "react";

import { DropdownMenu, Item } from "../index_with_tw_base";
import { Cog6ToothIcon } from "../index_with_tw_base";

const meta = {
  title: "Atoms/Item",
  component: Item,
} satisfies Meta<typeof Item>;

export default meta;

export const ListItemExample = () => (
  <div className="s-grid s-grid-cols-3 s-gap-8">
    <div>
      Entry example:
      <div className="s-w-70 s-flex s-justify-start s-bg-structure-50 s-p-8">
        <Item.List className="s-w-full">
          <Item.SectionHeader label="Section Header" />
          <Item.Entry label="Deploying a new Sparkle Icon set and GitHub action" />
          <Item.Entry label="Item 2" />
          <Item.Entry label="Adding custom colors and color schemes to Tailwind" />
          <Item.SectionHeader label="Section Header" />
          <Item.Entry label="Deploying a new Sparkle Icon set and GitHub action" />
          <Item.Entry label="Item 2" />
          <Item.Entry label="Adding custom colors and color schemes to Tailwind" />
        </Item.List>
      </div>
    </div>
    <div>
      Navigation example:
      <Item.List className="s-w-40">
        <Item.SectionHeader label="Section Header" variant="secondary" />
        <Item.Navigation label="Item 1" icon={Cog6ToothIcon} selected />
        <Item.Navigation label="Item 2" icon={Cog6ToothIcon} />
        <Item.Navigation label="Item 3" icon={Cog6ToothIcon} />
        <Item.SectionHeader label="Section Header" variant="secondary" />
        <Item.Navigation label="Item 1" icon={Cog6ToothIcon} />
        <Item.Navigation label="Item 2" icon={Cog6ToothIcon} />
        <Item.Navigation label="Item 3" icon={Cog6ToothIcon} />
      </Item.List>
    </div>

    <div>
      Avatar example:
      <Item.List className="s-w-40">
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Black_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Pink_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Orange_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Red_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Lime_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          description="description of the avatar"
          visual="https://dust.tt/static/droidavatar/Droid_Teal_2.jpg"
        />
      </Item.List>
    </div>
    <div>
      Dropdown example:
      <DropdownMenu>
        <DropdownMenu.Button label="Dust" />
        <DropdownMenu.Items>
          <DropdownMenu.Item label="item 1" href="#" />
          <DropdownMenu.Item label="item 2" href="#" />
        </DropdownMenu.Items>
      </DropdownMenu>
    </div>
  </div>
);
