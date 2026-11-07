import { createFileRoute } from "@tanstack/react-router";
import { DataSourcesPage } from "@/components/analysis";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Sources & Coverage — CommodiSense" },
      { name: "description", content: "Provider status, historical coverage, refresh controls and data quality for gold and crude oil." },
      { property: "og:title", content: "Data Sources & Coverage — CommodiSense" },
      { property: "og:description", content: "Provider status, historical coverage, refresh controls and data quality for gold and crude oil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataSourcesPage,
});
