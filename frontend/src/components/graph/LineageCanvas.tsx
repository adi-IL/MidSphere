import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import type { BlastNode } from "../../lib/types";

interface Props {
  nodes: BlastNode[];
  selectedUrn: string | null;
  onSelect: (urn: string) => void;
}

function DatasetNode({
  data,
}: NodeProps<{ label: string; impacted: boolean; hop: number }>) {
  return (
    <div
      className={`min-w-[132px] rounded-md border bg-panel px-3 py-2 ${
        data.impacted ? "border-bad/50" : "border-line2"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-faint !h-1.5 !w-1.5 !border-0" />
      <div className="text-2xs uppercase tracking-wide text-faint">
        hop {data.hop}
      </div>
      <div className="text-xs font-medium text-ink">{data.label}</div>
      <div
        className={`mt-1 text-2xs font-medium ${data.impacted ? "text-bad" : "text-good"}`}
      >
        {data.impacted ? "impacted" : "open"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-faint !h-1.5 !w-1.5 !border-0" />
    </div>
  );
}

const nodeTypes = { dataset: DatasetNode };

export function LineageCanvas({ nodes, selectedUrn, onSelect }: Props) {
  const flowNodes: Node[] = useMemo(() => {
    const byHop = new Map<number, BlastNode[]>();
    for (const n of nodes) {
      const list = byHop.get(n.hop) ?? [];
      list.push(n);
      byHop.set(n.hop, list);
    }
    const result: Node[] = [];
    for (const [hop, list] of [...byHop.entries()].sort((a, b) => a[0] - b[0])) {
      list.forEach((n, i) => {
        result.push({
          id: n.urn,
          type: "dataset",
          position: { x: hop * 220 + 40, y: i * 110 + 80 },
          data: { label: n.name, impacted: n.impacted, hop: n.hop },
          selected: n.urn === selectedUrn,
        });
      });
    }
    return result;
  }, [nodes, selectedUrn]);

  const edges: Edge[] = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.hop - b.hop);
    const edgesOut: Edge[] = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = 0; j < sorted.length; j++) {
        if (sorted[j].hop === sorted[i].hop + 1) {
          const parent = sorted[i];
          const child = sorted[j];
          if (
            (parent.hop === 0 && child.hop === 1) ||
            (parent.hop === 1 && child.hop === 2)
          ) {
            const hot = child.impacted;
            edgesOut.push({
              id: `${parent.urn}->${child.urn}`,
              source: parent.urn,
              target: child.urn,
              className: hot ? undefined : "edge-flow",
              style: {
                stroke: hot ? "#ff4d4f" : "#444",
                strokeWidth: 1.5,
              },
              animated: !hot,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: hot ? "#ff4d4f" : "#666",
                width: 16,
                height: 16,
              },
            });
          }
        }
      }
    }
    return edgesOut;
  }, [nodes]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => onSelect(node.id),
    [onSelect],
  );

  return (
    <div className="h-full w-full bg-canvas">
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-line bg-panel/95 px-3 py-2 text-2xs text-mute backdrop-blur">
        Lineage ·{" "}
        <span className="text-good">open</span> ·{" "}
        <span className="text-bad">selective quarantine</span>
      </div>
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background color="#1a1a1a" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
