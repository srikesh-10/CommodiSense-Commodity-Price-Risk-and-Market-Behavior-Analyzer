import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/pages";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Model Insights — CommodiSense" },
      { name: "description", content: "Model Insights for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Model Insights — CommodiSense" },
      { property: "og:description", content: "Model Insights for gold and crude oil market behavior analysis." },
    ],
  }),
  component: InsightsPage,
});
