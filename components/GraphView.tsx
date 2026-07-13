"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { POST_CATEGORIES } from "@/lib/categories";

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

interface GraphViewProps {
  data: GraphData;
}

const categoryColors = Object.fromEntries(
  POST_CATEGORIES.map((category) => [category.id, category.graphColor])
);

export default function GraphView({ data }: GraphViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      router.push(`/posts/${node.id}`);
    },
    [router]
  );

  const getNodeColor = useCallback(
    (node: GraphNode) => {
      if (hoveredNode === node.id) {
        return "#0a0a0a";
      }
      return categoryColors[node.category] ?? "#595959";
    },
    [hoveredNode]
  );

  const getLinkColor = useCallback(
    (link: { source: GraphNode | string; target: GraphNode | string }) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (hoveredNode === sourceId || hoveredNode === targetId) {
        return "#0a0a0a";
      }
      return "#b7b4ad";
    },
    [hoveredNode]
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id || null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  return (
    <div ref={containerRef} className="graph-canvas">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={data}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#f2f1ed"
          nodeColor={getNodeColor}
          nodeRelSize={6}
          nodeLabel={(node: GraphNode) => node.title}
          linkColor={getLinkColor}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      )}
    </div>
  );
}
