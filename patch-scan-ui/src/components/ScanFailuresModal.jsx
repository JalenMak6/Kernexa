import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { fmtDate } from "../utils/helpers.jsx";

const REASON_STYLE = {
  unreachable: { wrap: "bg-orange-tint border-orange-border", dot: "bg-orange", text: "text-orange-dark", badge: "text-orange-darker bg-bg-card border-orange-border" },
  task_failed: { wrap: "bg-red-tint border-red-border",    dot: "bg-red",    text: "text-red-dark",    badge: "text-red-dark bg-bg-card border-red-border" },
};
const DEFAULT_REASON_STYLE = { wrap: "bg-bg-page border-border-base", dot: "bg-text-ghost", text: "text-text-muted", badge: "text-text-muted bg-bg-card border-border-base" };

export function ScanFailuresModal({ scanId, onClose }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("failures");

  useEffect(() => {
    apiFetch(`/api/scans/${scanId}/failures`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [scanId]);

  const failures       = data?.host_failures || {};
  const failureEntries = Object.entries(failures);

  return (
    <div className="fixed inset-0 bg-[var(--backdrop-dark)] z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-[860px] max-h-[85vh] flex flex-col shadow-modal overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-base flex items-center justify-between">
          <div>
            <div className="font-extrabold text-xl text-text-primary">Scan Details</div>
            <div className="text-xs text-text-ghost mt-0.5 mono">{scanId}</div>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className="flex gap-2 text-sm">
                <span className="bg-bg-subtle px-2.5 py-1 rounded-md text-text-muted">{fmtDate(data.scanned_at)}</span>
                {data.status === "successful"
                  ? <span className="bg-green-tint text-green-dark border border-green-border-lt px-2.5 py-1 rounded-md font-semibold">Successful</span>
                  : <span className="bg-red-tint text-red-dark border border-red-border px-2.5 py-1 rounded-md font-semibold">{data.status}</span>
                }
                <span className="bg-bg-subtle px-2.5 py-1 rounded-md text-text-muted mono">rc={data.rc}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="bg-bg-subtle border border-border-muted rounded-base w-8 h-8 cursor-pointer flex items-center justify-center text-lg text-text-secondary hover:bg-border-base transition-colors"
            >×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-base px-6">
          {[
            { id: "failures", label: `Failed Hosts (${failureEntries.length})` },
            { id: "log",      label: "Ansible Log" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 border-none bg-transparent cursor-pointer text-md font-[inherit] -mb-px transition-colors
                ${activeTab === t.id
                  ? "font-bold text-blue border-b-2 border-blue"
                  : "font-medium text-text-faint border-b-2 border-transparent"
                }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-[3px] border-border-base border-t-blue rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-text-ghost">Failed to load scan details</div>
          ) : activeTab === "failures" ? (
            failureEntries.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-[32px] mb-3">✅</div>
                <div className="font-bold text-green-dark text-lg">All hosts completed successfully</div>
                <div className="text-text-ghost text-md mt-1">No failures recorded for this scan</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {failureEntries.map(([host, failure]) => {
                  const s = REASON_STYLE[failure.reason] ?? DEFAULT_REASON_STYLE;
                  return (
                    <div key={host} className={`${s.wrap} border rounded-lg p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                          <span className={`font-bold text-md text-text-primary mono`}>{host}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className={`text-xs font-bold ${s.badge} border px-2 py-0.5 rounded-sm uppercase tracking-wide`}>
                            {failure.reason === "unreachable" ? "Unreachable" : "Task Failed"}
                          </span>
                          {failure.task && (
                            <span className="text-xs text-text-faint bg-bg-card border border-border-base px-2 py-0.5 rounded-sm">{failure.task}</span>
                          )}
                        </div>
                      </div>
                      {failure.msg && (
                        <div className="text-sm text-text-secondary bg-bg-card border border-border-base rounded-md px-3 py-2.5 mono whitespace-pre-wrap break-words leading-relaxed">
                          {failure.msg}
                        </div>
                      )}
                      {failure.stderr && (
                        <div className="mt-2">
                          <div className="text-xxs font-bold text-text-ghost tracking-widest uppercase mb-1">stderr</div>
                          <div className="text-xs text-red-dark bg-bg-card border border-red-border rounded-md px-3 py-2 mono whitespace-pre-wrap break-words">
                            {failure.stderr}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div>
              {data.ansible_log ? (
                <pre className="text-xs text-text-primary bg-bg-sidebar rounded-lg p-5 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed mono m-0">
                  {data.ansible_log}
                </pre>
              ) : (
                <div className="text-center py-16 text-text-ghost">No log available for this scan</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
