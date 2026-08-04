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

function DatasetNode({ data }: NodeProps<{ label: string; impacted: boolean; hop: number }>) {
  return (
    <div
      className={`min-w-[140px] rounded-lg border px-3 py-2 shadow-panel ${
        data.impacted
          ? "border-broken/60 bg-panel ring-2 ring-broken/40"
          : "border-healthy/40 bg-panel"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-dim" />
      <div className="text-[10px] uppercase text-dim">hop {data.hop}</div>
      <div className="text-sm font-medium">{data.label}</div>
      <div
        className={`mt-1 text-[10px] font-semibold ${data.impacted ? "text-broken" : "text-healthy"}`}
      >
        {data.impacted ? "QUARANTINE PATH" : "HEALTHY"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-dim" />
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
          // connect sequential hops from each parent-ish (healthcare fork)
          const parent = sorted[i];
          const child = sorted[j];
          // raw→staging (hop0→1): only when parent hop 0
          // staging→marts (hop1→2): parent hop 1 to both hop2
          if (
            (parent.hop === 0 && child.hop === 1) ||
            (parent.hop === 1 && child.hop === 2)
          ) {
            const broken = parent.impacted && child.impacted;
            edgesOut.push({
              id: `${parent.urn}->${child.urn}`,
              source: parent.urn,
              target: child.urn,
              className: broken ? undefined : "edge-flow",
              style: {
                stroke: broken ? "#f43f5e" : child.impacted ? "#f43f5e" : "#34d399",
                strokeWidth: 2,
                opacity: child.impacted || parent.impacted ? 1 : 0.85,
              },
              animated: !broken && !child.impacted,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: child.impacted ? "#f43f5e" : "#34d399",
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
    <div className="h-full w-full bg-app">
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-elevated bg-panel/90 px-3 py-2 text-xs text-muted backdrop-blur">
        Topological Theater ·{" "}
        <span className="text-healthy">healthy flow</span> ·{" "}
        <span className="text-broken">selective quarantine</span>
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
        <Background color="#334155" gap={18} size={1} />
        <Controls className="!bg-panel !border-elevated !shadow-panel" />
      </ReactFlow>
    </div>
  );
}
