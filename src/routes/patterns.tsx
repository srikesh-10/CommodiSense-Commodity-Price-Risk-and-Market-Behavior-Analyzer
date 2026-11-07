import { createFileRoute } from "@tanstack/react-router";
import { PatternsPage } from "@/components/pages";

export const Route = createFileRoute("/patterns")({
  head: () => ({
    meta: [
      { title: "Pattern Discovery — CommodiSense" },
      { name: "description", content: "Pattern Discovery for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Pattern Discovery — CommodiSense" },
      { property: "og:description", content: "Pattern Discovery for gold and crude oil market behavior analysis." },
    ],
  }),
  component: PatternsPage,
});
