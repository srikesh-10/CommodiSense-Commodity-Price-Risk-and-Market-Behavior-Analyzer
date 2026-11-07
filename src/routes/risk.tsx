import { createFileRoute } from "@tanstack/react-router";
import { RiskPage } from "@/components/pages";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk Analysis — CommodiSense" },
      { name: "description", content: "Risk Analysis for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Risk Analysis — CommodiSense" },
      { property: "og:description", content: "Risk Analysis for gold and crude oil market behavior analysis." },
    ],
  }),
  component: RiskPage,
});
