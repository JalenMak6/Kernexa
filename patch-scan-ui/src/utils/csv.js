import { kernelOutdated, fmtDate } from "./helpers.jsx";

export function exportToCSV(data) {
  if (!data?.hosts?.length) return;
  const rows = [];
  data.hosts.forEach(h => {
    if (!h.pending_security_packages?.length) {
      rows.push({
        Host: h.host,
        "Current Kernel": h.current_kernel_version,
        "Latest Kernel": h.latest_available_kernel_version,
        "Kernel Outdated": kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version) ? "Yes" : "No",
        "Package": "—",
        "Scan Time": fmtDate(data.scanned_at),
      });
    } else {
      h.pending_security_packages.forEach(pkg => {
        rows.push({
          Host: h.host,
          "Current Kernel": h.current_kernel_version,
          "Latest Kernel": h.latest_available_kernel_version,
          "Kernel Outdated": kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version) ? "Yes" : "No",
          "Package": pkg,
          "Scan Time": fmtDate(data.scanned_at),
        });
      });
    }
  });
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${(r[h] || "").toString().replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patch-scan-${data.scan_id?.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
