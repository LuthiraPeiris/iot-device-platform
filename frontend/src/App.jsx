import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import DeviceDetails from "./pages/DeviceDetails";
import FirmwareManagement from "./pages/FirmwareManagement";
import OtaLogs from "./pages/OtaLogs";
import axios from "axios";

const API_BASE_URL = "http://192.168.8.108:5000/api/devices";

function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState([]);

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === "ONLINE").length;
  const updateAvailable = devices.filter(
    (d) => d.ota_status === "UPDATE_AVAILABLE"
  ).length;
  const criticalDevices = devices.filter(
    (d) => d.health_status === "CRITICAL"
  ).length;

  const fetchData = async () => {
    try {
      const devicesRes = await axios.get(API_BASE_URL);
      const telemetryRes = await axios.get(`${API_BASE_URL}/telemetry`);

      setDevices(devicesRes.data);
      setTelemetry(telemetryRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  };

  const sendCommand = async (deviceId, command) => {
    try {
      await axios.post(`${API_BASE_URL}/command`, {
        device_id: deviceId,
        command: command,
      });

      alert(`${command} command sent to ${deviceId}`);
    } catch (error) {
      console.error("Error sending command:", error);
      alert("Failed to send command");
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            IoT Device Management Dashboard
          </h1>

          <p className="text-slate-400">
            ESP32 device registry, heartbeat, telemetry monitoring, and OTA status
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/firmware"
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700"
          >
            Firmware Management
          </Link>

          <Link
            to="/ota-logs"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700"
          >
            OTA Logs
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Total Devices</p>
          <h2 className="text-3xl font-bold mt-2">{totalDevices}</h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Online Devices</p>
          <h2 className="text-3xl font-bold mt-2 text-green-400">
            {onlineDevices}
          </h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Update Available</p>
          <h2 className="text-3xl font-bold mt-2 text-yellow-400">
            {updateAvailable}
          </h2>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Critical Devices</p>
          <h2 className="text-3xl font-bold mt-2 text-red-400">
            {criticalDevices}
          </h2>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Registered Devices</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-3">Device ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Current Firmware</th>
                <th className="p-3">OTA Status</th>
                <th className="p-3">Health</th>
                <th className="p-3">Latest Firmware</th>
                <th className="p-3">Last OTA Check</th>
                <th className="p-3">Last Seen</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {devices.map((device) => (
                <tr key={device.device_id} className="border-t border-slate-800">
                  <td className="p-3 font-medium">{device.device_id}</td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        device.status === "ONLINE"
                          ? "bg-green-600"
                          : "bg-slate-700"
                      }`}
                    >
                      {device.status || "OFFLINE"}
                    </span>
                  </td>

                  <td className="p-3">{device.firmware_version || "-"}</td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        device.ota_status === "UP_TO_DATE"
                          ? "bg-green-600"
                          : device.ota_status === "UPDATE_AVAILABLE"
                          ? "bg-yellow-600"
                          : "bg-slate-700"
                      }`}
                    >
                      {device.ota_status || "UNKNOWN"}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      title={device.health_message || "No health message"}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        device.health_status === "GOOD"
                          ? "bg-green-600"
                          : device.health_status === "WARNING"
                          ? "bg-yellow-600"
                          : device.health_status === "CRITICAL"
                          ? "bg-red-600"
                          : "bg-slate-700"
                      }`}
                    >
                      {device.health_status || "UNKNOWN"}
                    </span>
                  </td>

                  <td className="p-3">
                    {device.latest_firmware_version || "-"}
                  </td>

                  <td className="p-3">
                    {device.last_ota_check
                      ? new Date(device.last_ota_check).toLocaleString()
                      : "-"}
                  </td>

                  <td className="p-3">
                    {device.last_seen
                      ? new Date(device.last_seen).toLocaleString()
                      : "N/A"}
                  </td>

                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => sendCommand(device.device_id, "LED_ON")}
                        className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700"
                      >
                        LED ON
                      </button>

                      <button
                        onClick={() => sendCommand(device.device_id, "LED_OFF")}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700"
                      >
                        LED OFF
                      </button>

                      <Link
                        to={`/devices/${device.device_id}`}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700"
                      >
                        View Details
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {devices.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-400" colSpan="9">
                    No registered devices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Latest Telemetry</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-3">Device ID</th>
                <th className="p-3">Temperature</th>
                <th className="p-3">Battery</th>
                <th className="p-3">WiFi Signal</th>
                <th className="p-3">Time</th>
              </tr>
            </thead>

            <tbody>
              {telemetry.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="p-3">{item.device_id}</td>
                  <td className="p-3">{item.temperature} °C</td>
                  <td className="p-3">{item.battery}%</td>
                  <td className="p-3">{item.wifi_signal} dBm</td>
                  <td className="p-3">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : "N/A"}
                  </td>
                </tr>
              ))}

              {telemetry.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-400" colSpan="5">
                    No telemetry data found.
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices/:deviceId" element={<DeviceDetails />} />
        <Route path="/firmware" element={<FirmwareManagement />} />
        <Route path="/ota-logs" element={<OtaLogs />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;