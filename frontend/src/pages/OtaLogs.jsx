import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { API_BASE_URL } from "../config";

export default function OtaLogs() {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ota-logs`);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching OTA logs:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">OTA Logs</h1>

        <Link
          to="/"
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h2 className="text-xl font-semibold mb-4">Firmware Update History</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="p-3">Device ID</th>
                <th className="p-3">Current Version</th>
                <th className="p-3">Target Version</th>
                <th className="p-3">Status</th>
                <th className="p-3">Message</th>
                <th className="p-3">Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-400" colSpan="6">
                    No OTA logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-800">
                    <td className="p-3">{log.device_id}</td>

                    <td className="p-3">
                      {log.current_version || "-"}
                    </td>

                    <td className="p-3">
                      {log.target_version || "-"}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                          log.status === "UP_TO_DATE"
                            ? "bg-green-600"
                            : log.status === "UPDATE_AVAILABLE"
                            ? "bg-yellow-600"
                            : "bg-slate-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td className="p-3">
                      {log.message || "-"}
                    </td>

                    <td className="p-3">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}