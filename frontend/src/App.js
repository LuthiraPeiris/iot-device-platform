import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [devices, setDevices] = useState([]);

  const fetchDevices = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/devices");
      setDevices(res.data);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  };

  useEffect(() => {
    fetchDevices();

    const interval = setInterval(() => {
      fetchDevices();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>IoT Device Dashboard</h1>

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
            <tr key={d.id}>
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
    </div>
  );
}

export default App;