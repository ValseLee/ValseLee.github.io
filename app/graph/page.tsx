import { getGraphData } from "@/lib/posts";
import GraphPageClient from "./GraphPageClient";

export const metadata = {
  title: "Graph | Thoughts",
  description: "Visual map of connected posts",
};

export default function GraphPage() {
  const graphData = getGraphData();

  return <GraphPageClient data={graphData} />;
}
