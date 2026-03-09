import { useState } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { kernelOutdated, badge } from "../utils/helpers.jsx";

function osVersionBadge(osVersion) {
  if (!osVersion) return null;
  const lower = osVersion.toLowerCase();
  let bg, color, border;
  if (lower.includes("ubuntu")) {
    bg = "#fef3c7"; color = "#92400e"; border = "#fde68a";       // amber — Ubuntu
  } else if (lower.includes("rocky")) {
    bg = "#dbeafe"; color = "#1e40af"; border = "#93c5fd";       // blue  — Rocky
  } else if (lower.includes("redhat") || lower.includes("rhel")) {
    bg = "#fee2e2"; color = "#991b1b"; border = "#fca5a5";       // red   — RHEL
  } else {
    bg = "#f1f5f9"; color = "#475569"; border = "#cbd5e1";       // gray  — unknown
  }
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      padding: "2px 8px", borderRadius: 999, fontSize: 11,
      fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit"
    }}>
      {osVersion}
    </span>
  );
}

export function HostRow({ host }) {
  const [expanded, setExpanded] = useState(false);
  const outdated = kernelOutdated(host.current_kernel_version, host.latest_available_kernel_version);
  const pkgCount = host.pending_security_packages?.length || 0;

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
        onMouseLeave={e => e.currentTarget.style.background = ""}>
        <td style={{ padding: "14px 16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{host.host}</div>
        </td>
        <td style={{ padding: "14px 16px", width: 120 }}>
          {osVersionBadge(host.os_version)}
        </td>
        <td title={host.current_kernel_version} style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: "#475569", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
          {host.current_kernel_version}
        </td>
        <td title={host.latest_available_kernel_version} style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: "#475569", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
          {host.latest_available_kernel_version}
        </td>
        <td style={{ padding: "14px 16px", width: 130 }}>
          {outdated ? badge("Outdated", "red") : badge("Up to date", "green")}
        </td>
        <td style={{ padding: "14px 16px", width: 140 }}>
          {pkgCount > 0 ? badge(`${pkgCount} packages`, "yellow") : badge("Clean", "green")}
        </td>
        <td style={{ padding: "14px 16px", width: 80 }}>
          {pkgCount > 0 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#475569",
              display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit"
            }}>
              {expanded ? "Hide" : "View"}
              <div style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <Icon d={Icons.chevron} size={12} />
              </div>
            </button>
          )}
        </td>
      </tr>
      {expanded && pkgCount > 0 && (
        <tr style={{ background: "#f8fafc" }}>
          <td colSpan={7} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {host.pending_security_packages.map((pkg, i) => (
                <span key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontFamily: "monospace", color: "#334155" }}>
                  {pkg}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}