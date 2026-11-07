import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/pages";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CommodiSense" },
      { name: "description", content: "Settings for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Settings — CommodiSense" },
      { property: "og:description", content: "Settings for gold and crude oil market behavior analysis." },
    ],
  }),
  component: SettingsPage,
});
