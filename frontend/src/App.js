import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [telemetry, setTelemetry] = useState([]);

  const fetchDevices = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/devices");
      setDevices(res.data);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  };

  const fetchTelemetry = async (deviceId) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/devices/${deviceId}/telemetry`
      );

      setSelectedDevice(deviceId);
      setTelemetry(res.data);
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
    }
  };

  useEffect(() => {
    fetchDevices();

    const interval = setInterval(() => {
      fetchDevices();

      if (selectedDevice) {
        fetchTelemetry(selectedDevice);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>IoT Device Dashboard</h1>

      <h2>Devices</h2>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Device ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Last Seen</th>
          </tr>
        </thead>

        <tbody>
          {devices.map((d) => (
            <tr
              key={d.id}
              onClick={() => fetchTelemetry(d.device_id)}
              style={{ cursor: "pointer" }}
            >
              <td>{d.device_id}</td>
              <td>{d.device_name}</td>

              <td
                style={{
                  color: d.status === "ONLINE" ? "green" : "red",
                  fontWeight: "bold",
                }}
              >
                {d.status}
              </td>

              <td>{d.last_seen}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedDevice && (
        <div style={{ marginTop: "30px" }}>
          <h2>Telemetry for {selectedDevice}</h2>

          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Temperature</th>
                <th>Battery</th>
                <th>WiFi Signal</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {telemetry.map((t) => (
                <tr key={t.id}>
                  <td>{t.temperature} °C</td>
                  <td>{t.battery}%</td>
                  <td>{t.wifi_signal} dBm</td>
                  <td>{t.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;