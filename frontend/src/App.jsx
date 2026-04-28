import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = "http://192.168.8.102:5000/api/devices";

function App() {
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState([]);

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
      <h1 className="text-3xl font-bold mb-2">
        IoT Device Management Dashboard
      </h1>
      <p className="text-slate-400 mb-6">
        ESP32 device registry, heartbeat, and telemetry monitoring
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Registered Devices</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-900">
              <tr>
                <th className="p-3">Device ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Seen</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.device_id} className="border-t border-slate-800">
                  <td className="p-3">{device.device_id}</td>
                  <td className="p-3">{device.status}</td>
                  <td className="p-3">
                    {device.last_seen
                      ? new Date(device.last_seen).toLocaleString()
                      : "N/A"}
                  </td>
                  <td className="p-3 flex gap-2">
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
                  </td>
                </tr>
              ))}
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
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;