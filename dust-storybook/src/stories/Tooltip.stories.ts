import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "sparkle";

import "sparkle/dist/cjs/index.css";

const meta = {
  title: "Atoms/Tooltip",
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TooltipAbove: Story = {
  args: {
    label: "This is a tooltip",
    children: "Hover me",
    position: "above",
  },
};

export const TooltipBelow: Story = {
  args: {
    label: "This is a tooltip",
    children: "Hover me",
    position: "below",
  },
};
