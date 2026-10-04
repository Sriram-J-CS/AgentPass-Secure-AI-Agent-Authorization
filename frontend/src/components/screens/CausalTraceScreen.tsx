"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { TraceSummary, TraceGraphResponse, TraceNode } from "@/types/api";
import { DecisionChip } from "@/components/common/DecisionChip";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Network,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  Info,
  Clock,
  Shield,
  Layers,
} from "lucide-react";
import cytoscape from "cytoscape";

interface CausalTraceScreenProps {
  initialTraceId?: string | null;
}

export const CausalTraceScreen: React.FC<CausalTraceScreenProps> = ({
  initialTraceId,
}) => {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(
    initialTraceId || null
  );
  const [graphData, setGraphData] = useState<TraceGraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [loadingTraces, setLoadingTraces] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Load list of recent traces
  const loadTraces = async () => {
    try {
      setLoadingTraces(true);
      const res = await api.getTraces();
      const list = res.traces || [];
      setTraces(list);
      if (list.length > 0 && !selectedTraceId) {
        setSelectedTraceId(list[0].trace_id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load traces");
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    loadTraces();
  }, []);

  // Update selectedTraceId if initialTraceId prop changes
  useEffect(() => {
    if (initialTraceId) {
      setSelectedTraceId(initialTraceId);
    }
  }, [initialTraceId]);

  // Load graph for selected trace
  useEffect(() => {
    if (!selectedTraceId) return;

    let cancelled = false;
    const fetchGraph = async () => {
      try {
        setLoadingGraph(true);
        const data = await api.getTrace(selectedTraceId);
        if (!cancelled) {
          setGraphData(data);
          if (data.nodes.length > 0) {
            setSelectedNode(data.nodes[0]);
          } else {
            setSelectedNode(null);
          }
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trace graph");
        }
      } finally {
        if (!cancelled) setLoadingGraph(false);
      }
    };

    fetchGraph();
    return () => {
      cancelled = true;
    };
  }, [selectedTraceId]);

  // Initialize and update Cytoscape graph
  useEffect(() => {
    if (!containerRef.current || !graphData || graphData.nodes.length === 0) {
      return;
    }

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Build Cytoscape elements
    const elements: cytoscape.ElementDefinition[] = [];

    // Add nodes
    graphData.nodes.forEach((node, idx) => {
      let bg = "#0284C7"; // Default sky
      let border = "#38BDF8";

      if (node.decision === "ALLOW") {
        bg = "#059669";
        border = "#10B981";
      } else if (node.decision === "STEP_UP") {
        bg = "#D97706";
        border = "#F59E0B";
      } else if (node.decision === "DENY") {
        bg = "#DC2626";
        border = "#EF4444";
      } else if (node.severity === "critical") {
        bg = "#991B1B";
        border = "#F43F5E";
      }

      elements.push({
        data: {
          id: String(node.id),
          label: `${node.action || node.event_type}\n${node.decision} (${node.reason})`,
          rawNode: node,
          bgColor: bg,
          borderColor: border,
        },
      });
    });

    // Add edges
    graphData.edges.forEach((edge, idx) => {
      elements.push({
        data: {
          id: `e_${edge.source}_${edge.target}_${idx}`,
          source: String(edge.source),
          target: String(edge.target),
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(bgColor)",
            "border-color": "data(borderColor)",
            "border-width": 3,
            label: "data(label)",
            color: "#F8FAFC",
            "font-size": "11px",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "140px",
            width: 140,
            height: 60,
            shape: "round-rectangle",
            "overlay-padding": 6,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#00E5FF",
            "overlay-color": "#00E5FF",
            "overlay-opacity": 0.3,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2.5,
            "line-color": "#334155",
            "target-arrow-color": "#38BDF8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 1.2,
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        padding: 40,
        spacingFactor: 1.5,
      },
    });

    cy.on("tap", "node", (evt) => {
      const nodeData = evt.target.data("rawNode") as TraceNode;
      setSelectedNode(nodeData);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div className="space-y-6">
      {/* Header & Trace Picker */}
      <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Causal Trace Graph
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Interactive causal graph of policy checks, taint progression, and gate decisions reconstructed from the hash-chained audit log.
          </p>
        </div>

        {/* Trace Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">Trace:</label>
          <select
            value={selectedTraceId || ""}
            onChange={(e) => setSelectedTraceId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {traces.length === 0 ? (
              <option value="">No traces available</option>
            ) : (
              traces.map((t) => (
                <option key={t.trace_id} value={t.trace_id}>
                  {t.trace_id} ({t.events} events, {t.alerts} alerts) - {t.first_action}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Cytoscape Graph (8 cols) & Node Details (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cytoscape Canvas */}
        <div className="lg:col-span-8 glass-card p-5 rounded-2xl flex flex-col h-[580px] relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Causal Graph Visualization
              </h3>
            </div>

            {/* Graph Controls */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={handleZoomIn}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleFit}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Fit to Screen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Graph Container */}
          <div className="flex-1 w-full h-full relative overflow-hidden mt-3 rounded-xl bg-[#070A12] border border-slate-800/80">
            {loadingGraph ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                Reconstructing graph...
              </div>
            ) : !graphData || graphData.nodes.length === 0 ? (
              <EmptyState
                message="No graph data for this trace."
                subtext="Run a scenario from the Agent Runner to generate a causal trace."
              />
            ) : null}

            <div ref={containerRef} className="w-full h-full" />
          </div>
        </div>

        {/* Node Details Panel (Matching Image 8) */}
        <div className="lg:col-span-4 glass-card p-5 rounded-2xl flex flex-col h-[580px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Node Details
            </h3>
            {selectedNode && (
              <DecisionChip decision={selectedNode.decision} size="sm" />
            )}
          </div>

          <div className="flex-1 mt-4">
            {!selectedNode ? (
              <EmptyState message="Click on any graph node to inspect details." />
            ) : (
              <div className="space-y-4 text-xs">
                {/* Title & Type */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-sm text-white block">
                    {selectedNode.action || selectedNode.event_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Type: Policy Check
                    </span>
                    <SeverityBadge severity={selectedNode.severity} />
                  </div>
                </div>

                {/* Key Attributes */}
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">EVENT ID:</span>
                    <span className="text-slate-200">#{selectedNode.id}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">REASON:</span>
                    <span className="text-cyan-400 font-bold">{selectedNode.reason}</span>
                  </div>
                  {selectedNode.tool && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-500">TOOL:</span>
                      <span className="text-slate-200">{selectedNode.tool}</span>
                    </div>
                  )}
                  {selectedNode.alert && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-500">ALERT:</span>
                      <span className="text-rose-400 font-bold">
                        {selectedNode.alert}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-500">TIMESTAMP:</span>
                    <span className="text-slate-300">
                      {new Date(selectedNode.time).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Explanation / Evidence (Matching Image 8) */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Explanation & Evidence
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {selectedNode.explanation ||
                      `Decision ${selectedNode.decision} made with reason ${selectedNode.reason}.`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
