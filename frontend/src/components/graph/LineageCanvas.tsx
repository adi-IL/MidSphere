import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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

export function LineageCanvas({ nodes, selectedUrn, onSelect, activeScenarioLabel = "Pipeline" }: Props) {
  const [timeStep, setTimeStep] = useState<number>(4); // Default to Step 4 (LIVE / Latest)

  // Compute time-travel filtered node state
  const activeNodes = useMemo(() => {
    return nodes.map((n) => {
      let nodeImpacted = n.impacted;

      // Time travel masking
      if (timeStep === 0) {
        nodeImpacted = false; // Baseline
      } else if (timeStep === 1) {
        nodeImpacted = n.hop === 0 && n.impacted; // Source only
      } else if (timeStep === 2) {
        nodeImpacted = (n.hop === 0 || n.hop === 1) && n.impacted; // Up to Hop 1
      }

      return {
        ...n,
        impacted: nodeImpacted,
      };
    });
  }, [nodes, timeStep]);

  // Compute Focus Mode connected set
  const focusConnectedUrns = useMemo(() => {
    if (!selectedUrn) return null;
    const connected = new Set<string>([selectedUrn]);

    // Find direct parent/child connections
    activeNodes.forEach((n) => {
      if (Math.abs(n.hop - (nodes.find((x) => x.urn === selectedUrn)?.hop ?? 0)) <= 1) {
        connected.add(n.urn);
      }
    });
    return connected;
  }, [selectedUrn, activeNodes, nodes]);

  // Generate Flow Nodes with generous horizontal (380px) and vertical (220px) spacing
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
        const isDimmed = focusConnectedUrns !== null && !focusConnectedUrns.has(n.urn);

        result.push({
          id: n.urn,
          type: "dataset",
          // X gap: 380px gives generous 145px space for edge labels
          // Y gap: 220px gives 50px vertical clearance between cards
          position: { x: hop * 380 + 80, y: i * 220 + 80 },
          data: {
            label: n.name,
            impacted: n.impacted,
            hop: n.hop,
            urn: n.urn,
            reason: n.reason,
            dimmed: isDimmed,
            // Illustrative stage chrome only — not live GMS metrics
            rows: n.hop === 0 ? "source" : n.hop === 1 ? "staging" : "mart",
            latency: n.impacted ? "on blast path" : "open fork",
            riskScore: n.impacted ? (n.hop === 0 ? 70 : 55) : 0,
            owner: n.hop === 0 ? "Ingestion" : n.hop === 1 ? "Transform" : "Analytics",
            downstreamCount: n.hop === 0 ? 3 : n.hop === 1 ? 2 : 1,
          },
          selected: n.urn === selectedUrn,
        });
      });
    }
    return result;
  }, [activeNodes, selectedUrn, focusConnectedUrns]);

  // Generate Smoothstep Custom Edges
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
                volume: parent.hop === 0 ? "hop 0→1" : "hop 1→2",
                piiCount: isHot && hotLabel.includes("PII") ? 1 : 0,
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
    <div className="h-full w-full bg-canvas relative overflow-hidden select-none">
      {/* Top Header Controls Overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-3">
        <div className="rounded-xl border border-line bg-panel/90 px-3.5 py-2 font-mono text-[10px] uppercase tracking-wide text-mute backdrop-blur-md shadow-2xl flex items-center gap-2.5">
          <span className="font-bold text-ink">{activeScenarioLabel} Lineage</span>
          <span className="text-line2">|</span>
          <span className="inline-flex items-center gap-1.5 text-good font-semibold">
            <span className="h-2 w-2 rounded-full bg-good shadow-sm shadow-good" />
            open
          </span>
          <span className="text-line2">|</span>
          <span className="inline-flex items-center gap-1.5 text-bad font-semibold">
            <span className="h-2 w-2 rounded-full bg-bad animate-ping" />
            quarantined
          </span>
        </div>

        {selectedUrn && (
          <button
            type="button"
            onClick={() => onSelect("")}
            className="pointer-events-auto rounded-xl border border-line bg-panel/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-mute hover:text-ink hover:border-faint backdrop-blur-md transition-colors shadow-2xl"
          >
            Reset Focus Mode
          </button>
        )}
      </div>

      {/* ReactFlow Canvas */}
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "custom" }}
      >
        <Background color="#1c1c1c" gap={28} size={1} />
        <Controls showInteractive={false} className="!bg-panel !border-line !shadow-2xl overflow-hidden" />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as NodeDataModel;
            return d?.impacted ? "#ef4444" : "#10b981";
          }}
          maskColor="rgba(0, 0, 0, 0.75)"
          className="!bg-panel !border-line !rounded-xl !shadow-2xl overflow-hidden"
        />
      </ReactFlow>

      {/* Time Travel Forensic Slider Mode */}
      <TimeTravelBar
        currentStep={timeStep}
        onStepChange={setTimeStep}
        activeScenarioLabel={activeScenarioLabel}
      />
    </div>
  );
}
