import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate, badge } from "../utils/helpers.jsx";
import { ComplianceTrendChart } from "./ComplianceTrendChart.jsx";

const thCls = "px-4 py-3 text-left text-xs font-bold tracking-widest uppercase text-text-faint cursor-default select-none whitespace-nowrap bg-transparent";

export function ScanHistoryTab({ history, onSelectScan }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Trend chart */}
      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
        <ComplianceTrendChart history={history} />
      </div>

      {/* History table */}
      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-border-subtle font-bold text-base text-text-primary">
          {history.length} scan run{history.length !== 1 ? "s" : ""}
        </div>
        <table className="w-full border-collapse table-fixed">
          <thead className="bg-bg-page border-b border-border-subtle">
            <tr>
              <th className={`${thCls} w-[140px]`}>Scan ID</th>
              <th className={thCls}>Triggered At</th>
              <th className={`${thCls} w-[140px]`}>Hosts Scanned</th>
              <th className={`${thCls} w-[120px]`}>Status</th>
              <th className={`${thCls} w-[100px]`}>Return Code</th>
              <th className={`${thCls} w-[140px]`}>Failed Hosts</th>
              <th className={`${thCls} w-[120px]`}>Details</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0
              ? <tr><td colSpan={7} className="py-8 text-center text-text-ghost text-md">No scan history yet</td></tr>
              : history.map(s => (
                <tr key={s.scan_id} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3.5 text-xs mono text-text-faint">{s.scan_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3.5 text-md text-text-secondary">{fmtDate(s.scanned_at)}</td>
                  <td className="px-4 py-3.5 text-md text-text-secondary">{s.host_count} hosts</td>
                  <td className="px-4 py-3.5">{s.status === "successful" ? badge("Successful", "green") : badge(s.status, "red")}</td>
                  <td className={`px-4 py-3.5 text-sm mono font-semibold ${s.rc === 0 ? "text-green" : "text-red"}`}>{s.rc}</td>
                  <td className="px-4 py-3.5">
                    {s.failure_count > 0
                      ? <span className="inline-flex items-center gap-1 bg-red-tint text-red-dark border border-red-border rounded-md px-2.5 py-0.5 text-sm font-bold">
                          <div className="w-1.5 h-1.5 rounded-full bg-red" />{s.failure_count} failed
                        </span>
                      : <span className="inline-flex items-center gap-1 bg-green-tint text-green-dark border border-green-border-lt rounded-md px-2.5 py-0.5 text-sm font-semibold">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-bright" />All OK
                        </span>
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => onSelectScan(s.scan_id)}
                      className="px-3 py-1 rounded-md text-sm font-semibold border border-border-base bg-bg-page text-text-muted-c cursor-pointer font-[inherit] inline-flex items-center gap-1 hover:bg-bg-subtle hover:border-border-muted transition-colors"
                    >
                      <Icon d={Icons.search} size={11} color="var(--text-faint)" /> View
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
