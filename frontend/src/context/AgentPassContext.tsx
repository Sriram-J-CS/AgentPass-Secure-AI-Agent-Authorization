"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  StateResponse,
  AuditRecord,
  SSEEvent,
  PassView,
  ChainView,
} from "@/types/api";
import { api, API_BASE_URL } from "@/lib/api";

export interface ToastMessage {
  id: string;
  type: "info" | "warn" | "error" | "success" | "critical";
  title: string;
  message: string;
  timestamp: Date;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

interface AgentPassContextType {
  state: StateResponse | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  sidecarReachable: boolean;
  liveEvents: AuditRecord[];
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  confirmDialog: ConfirmDialogOptions | null;
  requestConfirm: (opts: ConfirmDialogOptions) => void;
  closeConfirm: () => void;
  refreshState: () => Promise<void>;
  resetDemo: () => Promise<void>;
  bootstrapDemo: () => Promise<void>;
  revokePass: (passId: string) => Promise<void>;
  unfreezeChain: (chainId: string) => Promise<void>;
  clearTaint: (chainId: string) => Promise<void>;
  currentPass: PassView | null;
  currentChain: ChainView | null;
}

const AgentPassContext = createContext<AgentPassContextType | undefined>(
  undefined
);

export function AgentPassProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<AuditRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogOptions | null>(null);

  const seenEventIdsRef = useRef<Set<number>>(new Set());

  const addToast = useCallback(
    (
      type: ToastMessage["type"],
      title: string,
      message: string,
      duration = 6000
    ) => {
      const id = `${Date.now()}_${performance.now().toString(36)}`;
      const newToast: ToastMessage = {
        id,
        type,
        title,
        message,
        timestamp: new Date(),
      };
      setToasts((prev) => [newToast, ...prev.slice(0, 9)]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : "Failed to connect to gateway");
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE stream connection
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        es = new EventSource(`${API_BASE_URL}/api/events`);

        es.onopen = () => {
          setConnected(true);
        };

        es.onmessage = (e) => {
          try {
            if (!e.data || e.data.trim() === "" || e.data.startsWith(":")) {
              return;
            }
            const data: SSEEvent = JSON.parse(e.data);
            if (data.kind === "audit" && data.record) {
              const rec = data.record;
              if (!seenEventIdsRef.current.has(rec.id)) {
                seenEventIdsRef.current.add(rec.id);
                setLiveEvents((prev) => [rec, ...prev.slice(0, 99)]);

                // Alert toast on high or critical
                if (!data.backlog) {
                  if (rec.severity === "critical" || rec.severity === "high") {
                    addToast(
                      rec.severity === "critical" ? "critical" : "warn",
                      `Security Alert: ${rec.detail?.alert || rec.reason}`,
                      `${rec.event_type} on ${rec.tool || "system"}: ${rec.detail?.why || rec.detail?.result_summary || rec.reason}`
                    );
                  }
                }
              }
            } else if (data.kind === "approval") {
              addToast(
                "warn",
                "New Human Approval Required",
                `Step-up approval requested (ID: ${data.id})`
              );
              refreshState();
            }
          } catch {
            // ignore parse error
          }
        };

        es.onerror = () => {
          if (es) {
            es.close();
          }
          setConnected(false);
          // Auto reconnect after 3s
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();
    refreshState();

    // Fallback polling of GET /api/state every 3 seconds as required
    const pollInterval = setInterval(() => {
      refreshState();
    }, 3000);

    return () => {
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
    };
  }, [addToast, refreshState]);

  const requestConfirm = useCallback((opts: ConfirmDialogOptions) => {
    setConfirmDialog(opts);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const resetDemo = useCallback(async () => {
    try {
      await api.resetDemo();
      addToast("success", "Demo Reset", "All runtime state, keys, and audit logs cleared.");
      setLiveEvents([]);
      seenEventIdsRef.current.clear();
      await refreshState();
    } catch (err) {
      addToast(
        "error",
        "Reset Failed",
        err instanceof Error ? err.message : "Could not reset demo"
      );
    }
  }, [addToast, refreshState]);

  const bootstrapDemo = useCallback(async () => {
    try {
      const res = await api.bootstrapDemo();
      if (res.ok) {
        addToast(
          "success",
          "Quick Start Bootstrapped",
          "Pass requested, approved, and Ticket #1 claimed by sidecar."
        );
        await refreshState();
      }
    } catch (err) {
      addToast(
        "error",
        "Bootstrap Failed",
        err instanceof Error ? err.message : "Could not bootstrap demo"
      );
    }
  }, [addToast, refreshState]);

  const revokePass = useCallback(
    async (passId: string) => {
      try {
        await api.revokePass(passId);
        addToast("critical", "Kill Switch Triggered", `Pass ${passId} has been immediately revoked.`);
        await refreshState();
      } catch (err) {
        addToast(
          "error",
          "Revocation Failed",
          err instanceof Error ? err.message : "Could not revoke pass"
        );
      }
    },
    [addToast, refreshState]
  );

  const unfreezeChain = useCallback(
    async (chainId: string) => {
      try {
        await api.unfreezeChain(chainId);
        addToast(
          "success",
          "Chain Unfrozen",
          `Chain ${chainId} has been re-approved and unfrozen.`
        );
        await refreshState();
      } catch (err) {
        addToast(
          "error",
          "Unfreeze Failed",
          err instanceof Error ? err.message : "Could not unfreeze chain"
        );
      }
    },
    [addToast, refreshState]
  );

  const clearTaint = useCallback(
    async (chainId: string) => {
      try {
        await api.clearTaint(chainId);
        addToast(
          "info",
          "Taint Cleared",
          `Tainted context on chain ${chainId} marked as reviewed.`
        );
        await refreshState();
      } catch (err) {
        addToast(
          "error",
          "Clear Taint Failed",
          err instanceof Error ? err.message : "Could not clear taint"
        );
      }
    },
    [addToast, refreshState]
  );

  const sidecarReachable = state?.sidecar?.reachable ?? false;
  const currentPass = state?.pass ?? null;
  const currentChain = state?.chain ?? null;

  return (
    <AgentPassContext.Provider
      value={{
        state,
        loading,
        error,
        connected,
        sidecarReachable,
        liveEvents,
        toasts,
        dismissToast,
        confirmDialog,
        requestConfirm,
        closeConfirm,
        refreshState,
        resetDemo,
        bootstrapDemo,
        revokePass,
        unfreezeChain,
        clearTaint,
        currentPass,
        currentChain,
      }}
    >
      {children}
    </AgentPassContext.Provider>
  );
}

export function useAgentPass() {
  const context = useContext(AgentPassContext);
  if (!context) {
    throw new Error("useAgentPass must be used within an AgentPassProvider");
  }
  return context;
}
