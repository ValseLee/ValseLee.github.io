"use client";

import dynamic from "next/dynamic";

const GraphView = dynamic(() => import("@/components/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="graph-panel graph-loading">
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
    <article className="page-section graph-page">
      <p className="eyebrow">Connected writing</p>
      <h1>Graph</h1>
      <p className="graph-intro">Explore the links between articles. Select a node to open its post.</p>
      <div className="graph-panel">
        <GraphView data={data} />
      </div>
    </article>
  );
}
