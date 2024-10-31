import { Meta } from "@storybook/react";
import React from "react";

import {
  Cog6ToothIcon,
  CommandIcon,
  LightbulbIcon,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "../index_with_tw_base";

const meta = {
  title: "Components/Tabs",
} satisfies Meta;

export default meta;

export function TabExample() {
  return (
    <div className="s-w-80">
      <Tabs defaultValue="account">
        <TabsList className="s-px-2">
          <TabsTrigger value="account" label="Hello" icon={CommandIcon} />
          <TabsTrigger value="password" label="World" icon={LightbulbIcon} />
          <div className="s-grow" />
          <Tooltip
            trigger={<TabsTrigger value="settings" icon={Cog6ToothIcon} />}
            label="Admin"
          />
        </TabsList>
        <TabsContent value="account">Hello</TabsContent>
        <TabsContent value="password">World</TabsContent>
        <TabsContent value="settings">Settings</TabsContent>
      </Tabs>
    </div>
  );
}
