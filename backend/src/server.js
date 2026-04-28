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
  const { device_id, firmware_version } = req.body;

  if (!device_id) {
    return res.status(400).json({
      message: "device_id is required",
    });
  }

  const sql = `
    INSERT INTO devices (device_id, status, firmware_version)
    VALUES (?, 'online', ?)
    ON DUPLICATE KEY UPDATE
      status = 'online',
      firmware_version = VALUES(firmware_version),
      last_seen = CURRENT_TIMESTAMP
  `;

  db.query(sql, [device_id, firmware_version || "1.0.0"], (err) => {
    if (err) {
      console.error("Heartbeat error:", err);
      return res.status(500).json({
        message: "Database error",
      });
    }

    res.json({
      message: "Heartbeat updated successfully",
    });
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

app.get("/api/devices/:deviceId/telemetry", (req, res) => {
  const { deviceId } = req.params;

  const query = `
    SELECT 
      id,
      device_id,
      temperature,
      battery,
      wifi_signal,
      created_at
    FROM telemetry
    WHERE device_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `;

  db.query(query, [deviceId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

app.get("/api/devices/telemetry", (req, res) => {
  const sql = `
    SELECT *
    FROM telemetry
    ORDER BY created_at DESC
    LIMIT 50
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Telemetry fetch error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

app.post("/api/devices/command", (req, res) => {
  const { device_id, command } = req.body;

  if (!device_id || !command) {
    return res.status(400).json({
      message: "device_id and command are required",
    });
  }

  const sql = `
    INSERT INTO device_commands (device_id, command)
    VALUES (?, ?)
  `;

  db.query(sql, [device_id, command], (err, result) => {
    if (err) {
      console.error("Command insert error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({
      message: "Command created successfully",
      command_id: result.insertId,
    });
  });
});

app.get("/api/devices/command/:device_id", (req, res) => {
  const { device_id } = req.params;

  const sql = `
    SELECT *
    FROM device_commands
    WHERE device_id = ? AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(sql, [device_id], (err, results) => {
    if (err) {
      console.error("Command fetch error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.json({ command: null });
    }

    res.json(results[0]);
  });
});

app.post("/api/devices/command/ack", (req, res) => {
  const { command_id } = req.body;

  if (!command_id) {
    return res.status(400).json({
      message: "command_id is required",
    });
  }

  const sql = `
    UPDATE device_commands
    SET status = 'executed',
        executed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(sql, [command_id], (err) => {
    if (err) {
      console.error("Command ACK error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ message: "Command acknowledged" });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

