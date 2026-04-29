const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/firmware", express.static("firmware"));

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("IoT Device Platform Backend is running");
});

// Register device
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

// Device heartbeat
app.post("/api/devices/heartbeat", (req, res) => {
  const { device_id, firmware_version } = req.body;

  if (!device_id) {
    return res.status(400).json({
      message: "device_id is required",
    });
  }

  const sql = `
    INSERT INTO devices (device_id, status, firmware_version, last_seen)
    VALUES (?, 'online', ?, CURRENT_TIMESTAMP)
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
        error: err.message,
      });
    }

    res.json({
      message: "Heartbeat updated successfully",
    });
  });
});

// Get all devices
app.get("/api/devices", (req, res) => {
  const query = `
    SELECT 
      id,
      device_id,
      device_name,
      device_type,
      firmware_version,
      ota_status,
      latest_firmware_version,
      last_ota_check,
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
      console.error("Devices fetch error:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// Save telemetry from ESP32
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
        console.error("Telemetry insert error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({ message: "Telemetry saved successfully" });
    }
  );
});

// Get latest telemetry for dashboard
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
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json(results);
  });
});

// Get telemetry for one device
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
      console.error("Device telemetry fetch error:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// Get one device details
app.get("/api/devices/:deviceId", (req, res) => {
  const { deviceId } = req.params;

  const query = `
    SELECT 
      id,
      device_id,
      device_name,
      device_type,
      firmware_version,
      ota_status,
      latest_firmware_version,
      last_ota_check,
      CASE
        WHEN last_seen >= NOW() - INTERVAL 30 SECOND THEN 'ONLINE'
        ELSE 'OFFLINE'
      END AS status,
      last_seen,
      created_at
    FROM devices
    WHERE device_id = ?
    LIMIT 1
  `;

  db.query(query, [deviceId], (err, results) => {
    if (err) {
      console.error("Device details fetch error:", err);
      return res.status(500).json({
        message: "Server error",
        error: err.message,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.json(results[0]);
  });
});

// Send command from dashboard
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
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json({
      message: "Command created successfully",
      command_id: result.insertId,
    });
  });
});

// ESP32 checks pending command
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
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    if (results.length === 0) {
      return res.json({ command: null });
    }

    res.json(results[0]);
  });
});

// ESP32 confirms command executed
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
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json({ message: "Command acknowledged" });
  });
});

// Firmware update check
app.get("/api/firmware/check/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const currentVersion = req.query.version;

  const latestVersion = "1.0.1";

  const otaStatus =
    currentVersion !== latestVersion ? "UPDATE_AVAILABLE" : "UP_TO_DATE";

  const updateQuery = `
    UPDATE devices
    SET 
      firmware_version = ?,
      latest_firmware_version = ?,
      ota_status = ?,
      last_ota_check = NOW()
    WHERE device_id = ?
  `;

  db.query(
    updateQuery,
    [currentVersion, latestVersion, otaStatus, deviceId],
    (err) => {
      if (err) {
        console.error("Firmware check error:", err);
        return res.status(500).json({ error: err.message });
      }

      if (currentVersion !== latestVersion) {
        return res.json({
          updateAvailable: true,
          deviceId,
          currentVersion,
          latestVersion,
          firmwareUrl:
            "http://192.168.8.102:5000/firmware/esp32-001-v1.0.1.bin",
        });
      }

      res.json({
        updateAvailable: false,
        deviceId,
        currentVersion,
        latestVersion,
      });
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});