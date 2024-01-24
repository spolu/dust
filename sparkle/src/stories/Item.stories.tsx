import type { Meta } from "@storybook/react";
import React from "react";

import { More } from "@sparkle/icons/solid";
import { classNames } from "@sparkle/lib/utils";

import { DropdownMenu, Icon, Item } from "../index_with_tw_base";
import { Cog6ToothIcon } from "../index_with_tw_base";

const meta = {
  title: "Atoms/Item",
  component: Item,
} satisfies Meta<typeof Item>;

export default meta;

type ItemEllipsisActionProps = {
  disabled?: boolean;
};

const ItemEllipsisAction: React.FC<ItemEllipsisActionProps> = ({ disabled = false }) => {
  return (
    <div onClick={() => {!disabled && console.log('ellipsis clicked')}}>
      <Icon
        visual={More}
        className={classNames(
            "s-shrink-0 s-transition-all s-duration-200 s-ease-out s-opacity-50",
            disabled
              ? "s-text-element-500 dark:s-text-element-500-dark"
              : classNames(
                  "s-text-element-600 group-hover:s-text-action-400 group-active:s-text-action-700 dark:group-hover:s-text-action-600-dark dark:group-active:s-text-action-400-dark",
                  "hover:s-opacity-100 cursor-pointer"
                )
          )
        }
        size="sm"
      />
    </div>
  );
}

export const ListItemExample = () => (
  <div className="s-grid s-grid-cols-3 s-gap-8">
    <div>
      Entry example:
      <div className="s-w-70 s-flex s-justify-start s-bg-structure-50 s-p-8 dark:s-bg-structure-50-dark">
        <Item.List className="s-w-full">
          <Item.SectionHeader label="Section Header" />
          <Item.Entry
            label="Deploying a new Sparkle Icon set and GitHub action"
            selected
          />
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
        <Item.Navigation label="Item 3" icon={Cog6ToothIcon} disabled />
        <Item.SectionHeader label="Section Header" variant="secondary" />
        <Item.Navigation
          label="Item 1"
          icon={Cog6ToothIcon}
          description="Desciption of the item"
        />
        <Item.Navigation
          label="Item 2"
          icon={Cog6ToothIcon}
          description="Desciption of the item"
        />
        <Item.Navigation
          label="Item 3"
          icon={Cog6ToothIcon}
          description="Desciption of the item"
          disabled
        />
      </Item.List>
    </div>
    <div className="s-flex s-flex-col s-gap-8">
      Dropdown example:
      <div>
        <DropdownMenu>
          <DropdownMenu.Button label="Dust" />
          <DropdownMenu.Items>
            <DropdownMenu.Item label="item 1" href="#" />
            <DropdownMenu.Item label="item 2" href="#" />
          </DropdownMenu.Items>
        </DropdownMenu>
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenu.Button label="Dust" />
          <DropdownMenu.Items>
            <DropdownMenu.Item label="item 1" href="#" icon={Cog6ToothIcon} />
            <DropdownMenu.Item label="item 2" href="#" icon={Cog6ToothIcon} />
          </DropdownMenu.Items>
        </DropdownMenu>
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenu.Button label="Dust" />
          <DropdownMenu.Items>
            <DropdownMenu.Item
              label="item 1"
              href="#"
              icon={Cog6ToothIcon}
              description="Desciption of the item"
            />
            <DropdownMenu.Item
              label="item 2"
              href="#"
              icon={Cog6ToothIcon}
              description="Desciption of the item"
            />
          </DropdownMenu.Items>
        </DropdownMenu>
      </div>
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
          disabled
        />
      </Item.List>
    </div>

    <div>
      Avatar example:
      <Item.List className="s-w-40">
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Black_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Pink_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Orange_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Red_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Lime_2.jpg"
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Teal_2.jpg"
          disabled
        />
      </Item.List>
    </div>

    <div>
      Avatar example with ellipsis:
      <Item.List className="s-w-40">
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Black_2.jpg"
          hasAction={true}
          action={ItemEllipsisAction}
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Pink_2.jpg"
          hasAction={true}
          action={ItemEllipsisAction}
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Orange_2.jpg"
          hasAction={true}
          action={ItemEllipsisAction}
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Red_2.jpg"
          hasAction={true}
          action={ItemEllipsisAction}
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Lime_2.jpg"
          hasAction={true}
          action={ItemEllipsisAction}
        />
        <Item.Avatar
          label="@handle"
          visual="https://dust.tt/static/droidavatar/Droid_Teal_2.jpg"
          hasAction={true}
          action={() => <ItemEllipsisAction disabled />}
          disabled
        />
      </Item.List>
    </div>
  </div>
);
