import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import type { BlastNode } from "../../lib/types";
import { resolveHotEdgeLabel } from "../../lib/demoJob";
import { CustomNode, type NodeDataModel } from "./CustomNode";
import { CustomEdge } from "./CustomEdge";
import { TimeTravelBar } from "./TimeTravelBar";

interface Props {
  nodes: BlastNode[];
  selectedUrn: string | null;
  onSelect: (urn: string) => void;
  activeScenarioLabel?: string;
}

const nodeTypes = { dataset: CustomNode };
const edgeTypes = { custom: CustomEdge };

export function LineageCanvas({
  nodes,
  selectedUrn,
  onSelect,
  activeScenarioLabel = "Pipeline",
}: Props) {
  const [timeStep, setTimeStep] = useState<number>(4);
  const [showTimeTravel, setShowTimeTravel] = useState(false);

  const activeNodes = useMemo(() => {
    return nodes.map((n) => {
      let nodeImpacted = n.impacted;
      if (timeStep === 0) nodeImpacted = false;
      else if (timeStep === 1) nodeImpacted = n.hop === 0 && n.impacted;
      else if (timeStep === 2)
        nodeImpacted = (n.hop === 0 || n.hop === 1) && n.impacted;
      return { ...n, impacted: nodeImpacted };
    });
  }, [nodes, timeStep]);

  const focusConnectedUrns = useMemo(() => {
    if (!selectedUrn) return null;
    const connected = new Set<string>([selectedUrn]);
    const selectedHop = nodes.find((x) => x.urn === selectedUrn)?.hop ?? 0;
    activeNodes.forEach((n) => {
      if (Math.abs(n.hop - selectedHop) <= 1) connected.add(n.urn);
    });
    return connected;
  }, [selectedUrn, activeNodes, nodes]);

  const flowNodes: Node<NodeDataModel>[] = useMemo(() => {
    const byHop = new Map<number, BlastNode[]>();
    for (const n of activeNodes) {
      const list = byHop.get(n.hop) ?? [];
      list.push(n);
      byHop.set(n.hop, list);
    }

    const result: Node<NodeDataModel>[] = [];
    for (const [hop, list] of [...byHop.entries()].sort((a, b) => a[0] - b[0])) {
      list.forEach((n, i) => {
        const isDimmed =
          focusConnectedUrns !== null && !focusConnectedUrns.has(n.urn);
        result.push({
          id: n.urn,
          type: "dataset",
          position: { x: hop * 320 + 60, y: i * 160 + 60 },
          data: {
            label: n.name,
            impacted: n.impacted,
            hop: n.hop,
            urn: n.urn,
            reason: n.reason,
            dimmed: isDimmed,
          },
          selected: n.urn === selectedUrn,
        });
      });
    }
    return result;
  }, [activeNodes, selectedUrn, focusConnectedUrns]);

  const edges: Edge[] = useMemo(() => {
    const sorted = [...activeNodes].sort((a, b) => a.hop - b.hop);
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
            const isHot = parent.impacted && child.impacted;
            const hotLabel = resolveHotEdgeLabel(activeScenarioLabel);
            edgesOut.push({
              id: `${parent.urn}->${child.urn}`,
              source: parent.urn,
              target: child.urn,
              type: "custom",
              data: {
                hot: isHot,
                label: isHot ? hotLabel : "Open fork",
              },
            });
          }
        }
      }
    }
    return edgesOut;
  }, [activeNodes, activeScenarioLabel]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => onSelect(node.id),
    [onSelect],
  );

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded border border-line bg-panel px-2.5 py-1.5 text-2xs text-mute">
          <span className="font-medium text-ink">{activeScenarioLabel}</span>
          <span className="text-line2">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-line2" />
            Open
          </span>
          <span className="text-line2">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-bad" />
            Impacted
          </span>
        </div>

        {selectedUrn && (
          <button
            type="button"
            onClick={() => onSelect("")}
            className="pointer-events-auto rounded border border-line bg-panel px-2.5 py-1.5 text-2xs text-mute hover:text-ink"
          >
            Clear focus
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowTimeTravel((v) => !v)}
          className={`pointer-events-auto rounded border px-2.5 py-1.5 text-2xs ${
            showTimeTravel
              ? "border-line2 bg-elevated text-ink"
              : "border-line bg-panel text-mute hover:text-ink"
          }`}
        >
          Timeline
        </button>
      </div>

      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "custom" }}
      >
        <Background color="#1a1a1a" gap={24} size={1} />
        <Controls
          showInteractive={false}
          className="!border-line !bg-panel !shadow-none overflow-hidden"
        />
      </ReactFlow>

      {showTimeTravel && (
        <TimeTravelBar
          currentStep={timeStep}
          onStepChange={setTimeStep}
          activeScenarioLabel={activeScenarioLabel}
        />
      )}
    </div>
  );
}
