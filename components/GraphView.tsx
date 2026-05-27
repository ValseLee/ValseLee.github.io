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
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 80,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
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
        return "#FFFFFF";
      }
      return categoryColors[node.category] ?? "#CCCCCC";
    },
    [hoveredNode]
  );

  const getLinkColor = useCallback(
    (link: { source: GraphNode | string; target: GraphNode | string }) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (hoveredNode === sourceId || hoveredNode === targetId) {
        return "#FFFFFF";
      }
      return "#262626";
    },
    [hoveredNode]
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node?.id || null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={data}
      width={dimensions.width}
      height={dimensions.height}
      backgroundColor="#0A0A0A"
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
  );
}
