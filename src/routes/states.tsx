import { createFileRoute } from "@tanstack/react-router";
import { StatesPage } from "@/components/pages";

export const Route = createFileRoute("/states")({
  head: () => ({
    meta: [
      { title: "Hidden Market States — CommodiSense" },
      { name: "description", content: "Hidden Market States for gold and crude oil market behavior analysis." },
      { property: "og:title", content: "Hidden Market States — CommodiSense" },
      { property: "og:description", content: "Hidden Market States for gold and crude oil market behavior analysis." },
    ],
  }),
  component: StatesPage,
});
