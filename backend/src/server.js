const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("IoT Device Platform Backend is running");
});

const PORT = process.env.PORT || 5000;

app.post("/api/devices/register", (req, res) => {
  const { device_id, device_name, device_type, firmware_version } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  const query = `
    INSERT INTO devices (device_id, device_name, device_type, firmware_version)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [device_id, device_name, device_type, firmware_version],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Device already exists" });
        }

        return res.status(500).json({ error: err.message });
      }

      res.json({ message: "Device registered successfully" });
    }
  );
});

app.post("/api/devices/heartbeat", (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  const query = `
    UPDATE devices
    SET status = 'ONLINE', last_seen = NOW()
    WHERE device_id = ?
  `;

  db.query(query, [device_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ message: "Heartbeat received. Device is ONLINE" });
  });
});

app.get("/api/devices", (req, res) => {
  const query = `
    SELECT 
      id,
      device_id,
      device_name,
      device_type,
      firmware_version,
      CASE
        WHEN last_seen >= NOW() - INTERVAL 30 SECOND THEN 'ONLINE'
        ELSE 'OFFLINE'
      END AS status,
      last_seen,
      created_at
    FROM devices
    ORDER BY created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

app.post("/api/devices/telemetry", (req, res) => {
  const { device_id, temperature, battery, wifi_signal } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  const query = `
    INSERT INTO telemetry (device_id, temperature, battery, wifi_signal)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [device_id, temperature, battery, wifi_signal],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ message: "Telemetry saved successfully" });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

