"use client";

import dynamic from "next/dynamic";

const GraphView = dynamic(() => import("@/components/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-80px)]">
      <span className="text-subtext">Loading graph...</span>
    </div>
  ),
});

interface GraphNode {
  id: string;
  category: string;
  title: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphPageClientProps {
  data: GraphData;
}

export default function GraphPageClient({ data }: GraphPageClientProps) {
  return (
    <div className="fixed inset-0 top-20">
      <GraphView data={data} />
    </div>
  );
}
