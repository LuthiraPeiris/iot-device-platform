import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_BASE = "http://192.168.8.102:5000";

export default function DeviceDetails() {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchDeviceDetails() {
    try {
      const deviceRes = await fetch(`${API_BASE}/api/devices/${deviceId}`);
      const deviceData = await deviceRes.json();

      const telemetryRes = await fetch(
        `${API_BASE}/api/devices/${deviceId}/telemetry`
      );
      const telemetryData = await telemetryRes.json();

      setDevice(deviceData);
      setTelemetry(telemetryData);
    } catch (err) {
      console.error("Failed to fetch device details:", err);
    } finally {
      setLoading(false);
    }
  }

  async function checkFirmwareUpdate() {
  try {
    const res = await fetch(
      `${API_BASE}/api/firmware/check/${deviceId}?version=${device.firmware_version}`
    );

    const data = await res.json();

    if (data.updateAvailable) {
      alert(`Update available: ${data.latestVersion}`);
    } else {
      alert("Device firmware is already up to date");
    }

    fetchDeviceDetails();
  } catch (err) {
    console.error("Firmware check failed:", err);
    alert("Failed to check firmware update");
  }
}

  useEffect(() => {
    fetchDeviceDetails();

    const interval = setInterval(fetchDeviceDetails, 3000);
    return () => clearInterval(interval);
  }, [deviceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Loading device...
      </div>
    );
  }

  if (!device || device.message === "Device not found") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        Device not found
      </div>
    );
  }

  const latestTelemetry = telemetry[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <Link to="/" className="text-blue-400 hover:underline">
        ← Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-6">
        Device Details: {device.device_id}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold mb-3">Device Info</h2>

          <p>Device Name: {device.device_name || "-"}</p>
          <p>Device Type: {device.device_type || "-"}</p>
          <p>Status: {device.status || "-"}</p>
          <p>Current Firmware: {device.firmware_version || "-"}</p>
          <p>Latest Firmware: {device.latest_firmware_version || "-"}</p>
          <p>OTA Status: {device.ota_status || "-"}</p>
          <button onClick={checkFirmwareUpdate} className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700">
            Check Firmware Update
          </button>

          <p>
            Last OTA Check:{" "}
            {device.last_ota_check
              ? new Date(device.last_ota_check).toLocaleString()
              : "-"}
          </p>

          <p>
            Last Seen:{" "}
            {device.last_seen
              ? new Date(device.last_seen).toLocaleString()
              : "-"}
          </p>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold mb-3">Latest Telemetry</h2>

          {latestTelemetry ? (
            <>
              <p>Temperature: {latestTelemetry.temperature} °C</p>
              <p>Battery: {latestTelemetry.battery}%</p>
              <p>WiFi Signal: {latestTelemetry.wifi_signal} dBm</p>
              <p>
                Time:{" "}
                {latestTelemetry.created_at
                  ? new Date(latestTelemetry.created_at).toLocaleString()
                  : "-"}
              </p>
            </>
          ) : (
            <p className="text-slate-400">No telemetry found for this device.</p>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">Telemetry History</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-3">Temperature</th>
                <th className="p-3">Battery</th>
                <th className="p-3">WiFi Signal</th>
                <th className="p-3">Time</th>
              </tr>
            </thead>

            <tbody>
              {telemetry.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="p-3">{item.temperature} °C</td>
                  <td className="p-3">{item.battery}%</td>
                  <td className="p-3">{item.wifi_signal} dBm</td>
                  <td className="p-3">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}

              {telemetry.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-400" colSpan="4">
                    No telemetry history available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}