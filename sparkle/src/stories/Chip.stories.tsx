import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import { Chip } from "../index_with_tw_base";

const meta = {
  title: "Atoms/Chip",
  component: Chip,
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ListChipsExample = () => (
  <div>
    <Chip.List className="s-w-60">
      <Chip size="sm" label="From here to there" />
      <Chip size="sm" label="Chip 2" color="emerald" />
      <Chip size="sm" label="Adding custom stuff" color="violet" />
    </Chip.List>
    <div className="s-h-8" />
    <Chip.List className="s-w-40">
      <Chip size="md" label="Chip 1" color="amber" />
      <Chip size="md" label="Chip 2" />
      <Chip size="md" label="Chip 3" />
    </Chip.List>
  </div>
);

export const ChipEmerald: Story = {
  args: {
    label: "Settings",
    color: "emerald",
  },
};

export const ChipSM: Story = {
  args: {
    label: "Settings",
    color: "emerald",
  },
};

export const ChipMD: Story = {
  args: {
    label: "Settings",
    color: "emerald",
    size: "md",
  },
};

export const ChipAmber: Story = {
  args: {
    label: "Settings",
    size: "sm",
    color: "amber",
  },
};

export const ChipViolet: Story = {
  args: {
    label: "Conversation about Dust's origines",
    color: "violet",
  },
};
