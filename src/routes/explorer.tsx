import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/components/pages";

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Market Explorer — CommodiSense" },
      { name: "description", content: "Market Explorer for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Market Explorer — CommodiSense" },
      { property: "og:description", content: "Market Explorer for gold and crude oil market behavior analysis." },
    ],
  }),
  component: ExplorerPage,
});
