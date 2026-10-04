import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  subtext?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = "No requests yet. Run a scenario.",
  subtext,
  action,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-slate-800/80 bg-slate-900/30">
      <div className="p-3 mb-3 rounded-full bg-slate-800/50 text-slate-400 border border-slate-700/50">
        {icon || <Inbox className="w-6 h-6 text-slate-400" />}
      </div>
      <p className="text-sm font-medium text-slate-300">{message}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subtext}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
