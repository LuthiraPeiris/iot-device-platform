const express = require("express");
const cors = require("cors");
const db = require("./db");
const firmwareRoutes = require("./firmwareRoutes");
require("dotenv").config();
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/firmware", firmwareRoutes);

app.put("/api/firmware/:id/latest", (req, res) => {
  const { id } = req.params;

  db.query("UPDATE firmware_versions SET is_latest = 0", (resetErr) => {
    if (resetErr) {
      return res.status(500).json({ error: resetErr.message });
    }

    db.query(
      "UPDATE firmware_versions SET is_latest = 1 WHERE id = ?",
      [id],
      (updateErr, result) => {
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Firmware not found" });
        }

        res.json({ message: "Firmware marked as latest" });
      }
    );
  });
});

//app.use("/firmware", express.static("firmware"));
app.use("/firmware", express.static(path.join(__dirname, "../firmware")));

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

  const currentFirmware = firmware_version || "1.0.0";

  const sql = `
    INSERT INTO devices (device_id, status, firmware_version, last_seen)
    VALUES (?, 'online', ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      status = 'online',
      firmware_version = VALUES(firmware_version),
      last_seen = CURRENT_TIMESTAMP
  `;

  db.query(sql, [device_id, currentFirmware], (err) => {
    if (err) {
      console.error("Heartbeat error:", err);
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    const updateOtaHistorySql = `
      UPDATE ota_history
      SET 
        status = 'SUCCESS',
        message = CONCAT('OTA update completed successfully. Device is now running firmware ', ?)
      WHERE device_id = ?
        AND new_version = ?
        AND status = 'UPDATE_AVAILABLE'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    db.query(
      updateOtaHistorySql,
      [currentFirmware, device_id, currentFirmware],
      (historyErr) => {
        if (historyErr) {
          console.error("OTA history success update error:", historyErr);
        }

        res.json({
          message: "Heartbeat updated successfully",
        });
      }
    );
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
      health_status,
      health_message,
      latest_firmware_version,
      last_ota_check,
      CASE
        WHEN last_seen >= NOW() - INTERVAL 30 SECOND THEN 'ONLINE'
        ELSE 'OFFLINE'
      END AS status,
      last_seen,
      created_at,
      device_group,
      device_location
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

// Save telemetry + update health + clean old telemetry
app.post("/api/devices/telemetry", (req, res) => {
  const { device_id, temperature, battery, wifi_signal } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  let healthStatus = "GOOD";
  let healthMessage = "Device is working normally";

  if (battery < 20) {
    healthStatus = "CRITICAL";
    healthMessage = "Battery level is critically low";
  } else if (battery < 40) {
    healthStatus = "WARNING";
    healthMessage = "Battery level is low";
  }

  if (wifi_signal < -85) {
    healthStatus = "CRITICAL";
    healthMessage = "WiFi signal is very weak";
  } else if (wifi_signal < -70 && healthStatus !== "CRITICAL") {
    healthStatus = "WARNING";
    healthMessage = "WiFi signal is weak";
  }

  const insertTelemetryQuery = `
    INSERT INTO telemetry (device_id, temperature, battery, wifi_signal)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    insertTelemetryQuery,
    [device_id, temperature, battery, wifi_signal],
    (err) => {
      if (err) {
        console.error("Telemetry insert error:", err);
        return res.status(500).json({ error: err.message });
      }

      const updateHealthQuery = `
        UPDATE devices
        SET 
          health_status = ?,
          health_message = ?
        WHERE device_id = ?
      `;

      db.query(
        updateHealthQuery,
        [healthStatus, healthMessage, device_id],
        (healthErr) => {
          if (healthErr) {
            console.error("Health update error:", healthErr);
            return res.status(500).json({ error: healthErr.message });
          }

          const cleanupTelemetryQuery = `
            DELETE FROM telemetry
            WHERE id NOT IN (
              SELECT id FROM (
                SELECT id
                FROM telemetry
                WHERE device_id = ?
                ORDER BY created_at DESC
                LIMIT 30
              ) AS latest_records
            )
            AND device_id = ?
          `;

          db.query(
            cleanupTelemetryQuery,
            [device_id, device_id],
            (cleanupErr) => {
              if (cleanupErr) {
                console.error("Telemetry cleanup error:", cleanupErr);
              }

              res.json({
                message:
                  "Telemetry saved, health updated, and old telemetry cleaned successfully",
                health_status: healthStatus,
                health_message: healthMessage,
              });
            }
          );
        }
      );
    }
  );
});

// Get latest telemetry for main dashboard
app.get("/api/devices/telemetry", (req, res) => {
  const sql = `
    SELECT *
    FROM telemetry
    ORDER BY created_at DESC
    LIMIT 20
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

// Get latest telemetry for one device
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
    LIMIT 10
  `;

  db.query(query, [deviceId], (err, results) => {
    if (err) {
      console.error("Device telemetry fetch error:", err);
      return res.status(500).json({
        message: "Failed to fetch device telemetry",
        error: err.message,
      });
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
      health_status,
      health_message, 
      latest_firmware_version,
      last_ota_check,
      CASE
        WHEN last_seen >= NOW() - INTERVAL 30 SECOND THEN 'ONLINE'
        ELSE 'OFFLINE'
      END AS status,
      last_seen,
      created_at,
      device_group,
      device_location
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

  if (!currentVersion) {
    return res.status(400).json({
      message: "Current firmware version is required",
    });
  }

  const latestFirmwareQuery = `
    SELECT *
    FROM firmware_versions
    WHERE is_latest = 1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  db.query(latestFirmwareQuery, (err, results) => {
    if (err) {
      console.error("Latest firmware fetch error:", err);
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    if (results.length === 0) {
      return res.json({
        updateAvailable: false,
        deviceId,
        currentVersion,
        message: "No latest firmware found",
      });
    }

    const latestFirmware = results[0];
    const latestVersion = latestFirmware.version;
    const firmwareUrl = latestFirmware.file_url;

    const otaStatus =
      currentVersion !== latestVersion ? "UPDATE_AVAILABLE" : "UP_TO_DATE";

    const updateDeviceQuery = `
      UPDATE devices
      SET 
        firmware_version = ?,
        latest_firmware_version = ?,
        ota_status = ?,
        last_ota_check = NOW()
      WHERE device_id = ?
    `;

    db.query(
      updateDeviceQuery,
      [currentVersion, latestVersion, otaStatus, deviceId],
      (updateErr) => {
        if (updateErr) {
          console.error("Firmware check update error:", updateErr);
          return res.status(500).json({
            message: "Database error",
            error: updateErr.message,
          });
        }

        const logStatus =
  currentVersion !== latestVersion ? "UPDATE_AVAILABLE" : "UP_TO_DATE";

const logMessage =
  currentVersion !== latestVersion
    ? `Firmware update available from ${currentVersion} to ${latestVersion}`
    : `Device firmware is already up to date`;

const insertLogQuery = `
  INSERT INTO ota_logs (device_id, current_version, target_version, status, message)
  VALUES (?, ?, ?, ?, ?)
`;

db.query(
  insertLogQuery,
  [deviceId, currentVersion, latestVersion, logStatus, logMessage],
  (logErr) => {
    if (logErr) {
      console.error("OTA log insert error:", logErr);
    }

    if (currentVersion !== latestVersion) {
      return res.json({
        updateAvailable: true,
        deviceId,
        currentVersion,
        latestVersion,
        firmwareUrl,
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
      }
    );
  });
});

// Get OTA logs
app.get("/api/ota-logs", (req, res) => {
  const query = `
    SELECT *
    FROM ota_logs
    ORDER BY created_at DESC
    LIMIT 100
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("OTA logs fetch error:", err);
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json(results);
  });
});

app.put("/api/devices/:deviceId/group", (req, res) => {
  const deviceId = req.params.deviceId;
  const deviceGroup = req.body.device_group;

  if (!deviceGroup) {
    return res.status(400).json({ message: "device_group is required" });
  }

  const sql = `
    UPDATE devices
    SET device_group = ?
    WHERE device_id = ?
  `;

  db.query(sql, [deviceGroup, deviceId], (error, result) => {
    if (error) {
      console.error("Error updating device group:", error);
      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }

    res.json({
      message: "Device group updated successfully",
      device_id: deviceId,
      device_group: deviceGroup,
      affectedRows: result.affectedRows,
    });
  });
});

app.put("/api/devices/:deviceId/location", (req, res) => {
  const deviceId = req.params.deviceId;
  const deviceLocation = req.body.device_location;

  if (!deviceLocation) {
    return res.status(400).json({
      message: "device_location is required",
    });
  }

  const sql = `
    UPDATE devices
    SET device_location = ?
    WHERE device_id = ?
  `;

  db.query(sql, [deviceLocation, deviceId], (error, result) => {
    if (error) {
      console.error("Error updating device location:", error);
      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }

    res.json({
      message: "Device location updated successfully",
      device_id: deviceId,
      device_location: deviceLocation,
      affectedRows: result.affectedRows,
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});