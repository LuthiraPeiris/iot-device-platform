const express = require("express");
const router = express.Router();
const db = require("./db");
const multer = require("multer");
const path = require("path");

// Multer firmware upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "firmware/");
  },
  filename: (req, file, cb) => {
    const version = req.body.version.replace(/\./g, "_");
    cb(null, `firmware_v${version}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// GET all firmware versions
router.get("/", (req, res) => {
  const sql = "SELECT * FROM firmware_versions ORDER BY created_at DESC";

  db.query(sql, (error, rows) => {
    if (error) {
      console.error("Error fetching firmware versions:", error);
      return res.status(500).json({
        error: "Failed to fetch firmware versions",
        details: error.message,
      });
    }

    res.json(rows);
  });
});

// POST upload firmware .bin file
router.post("/upload", upload.single("firmware"), (req, res) => {
  const { version, target_group } = req.body;

  if (!version) {
    return res.status(400).json({ error: "Firmware version is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Firmware file is required" });
  }

  const fileName = req.file.filename;
  const fileUrl = `http://192.168.8.107:5000/firmware/${fileName}`;

  db.query("UPDATE firmware_versions SET is_latest = 0", (error) => {
    if (error) {
      console.error("Error clearing latest firmware:", error);
      return res.status(500).json({
        error: "Failed to clear latest firmware",
        details: error.message,
      });
    }

    const sql = `
      INSERT INTO firmware_versions
      (version, file_name, file_url, is_latest, target_group)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [version, fileName, fileUrl, 1, target_group || "default"], (error, result) => {
      if (error) {
        console.error("Error saving firmware:", error);
        return res.status(500).json({
          error: "Failed to save firmware",
          details: error.message,
        });
      }

      res.status(201).json({
        message: "Firmware uploaded successfully",
        id: result.insertId,
        version,
        file_name: fileName,
        file_url: fileUrl,
        is_latest: 1,
      });
    });
  });
});

// POST add new firmware version manually
router.post("/", (req, res) => {
  const { version, file_name, file_url, is_latest } = req.body;

  if (!version || !file_name || !file_url) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const latestValue = is_latest ? 1 : 0;

  if (latestValue === 1) {
    db.query("UPDATE firmware_versions SET is_latest = 0", (error) => {
      if (error) {
        console.error("Error clearing latest firmware:", error);
        return res.status(500).json({
          error: "Failed to update latest firmware",
          details: error.message,
        });
      }

      insertFirmware();
    });
  } else {
    insertFirmware();
  }

  function insertFirmware() {
    const sql = `
      INSERT INTO firmware_versions 
      (version, file_name, file_url, is_latest) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(
      sql,
      [version, file_name, file_url, latestValue],
      (error, result) => {
        if (error) {
          console.error("Error adding firmware version:", error);
          return res.status(500).json({
            error: "Failed to add firmware version",
            details: error.message,
          });
        }

        res.status(201).json({
          message: "Firmware version added successfully",
          id: result.insertId,
        });
      }
    );
  }
});

// GET latest firmware version
router.get("/latest", (req, res) => {
  const sql = `
    SELECT * FROM firmware_versions 
    WHERE is_latest = 1 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  db.query(sql, (error, rows) => {
    if (error) {
      console.error("Error fetching latest firmware:", error);
      return res.status(500).json({
        error: "Failed to fetch latest firmware",
        details: error.message,
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        update_available: false,
        message: "No latest firmware found",
      });
    }

    res.json({
      update_available: true,
      version: rows[0].version,
      file_url: rows[0].file_url,
      file_name: rows[0].file_name,
    });
  });
});

// POST set selected firmware as latest
router.post("/:id/set-latest", (req, res) => {
  const { id } = req.params;

  db.query("UPDATE firmware_versions SET is_latest = 0", (error) => {
    if (error) {
      console.error("Error clearing latest firmware:", error);
      return res.status(500).json({
        error: "Failed to clear latest firmware",
        details: error.message,
      });
    }

    db.query(
      "UPDATE firmware_versions SET is_latest = 1 WHERE id = ?",
      [id],
      (error, result) => {
        if (error) {
          console.error("Error setting latest firmware:", error);
          return res.status(500).json({
            error: "Failed to set latest firmware",
            details: error.message,
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Firmware version not found" });
        }

        res.json({ message: "Firmware version marked as latest" });
      }
    );
  });
});

// GET firmware update check for one device, using device group
router.get("/check/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const currentVersion = req.query.version;

  if (!currentVersion) {
    return res.status(400).json({
      message: "Current firmware version is required",
    });
  }

  const deviceQuery = `
    SELECT device_group
    FROM devices
    WHERE device_id = ?
    LIMIT 1
  `;

  db.query(deviceQuery, [deviceId], (deviceErr, deviceRows) => {
    if (deviceErr) {
      console.error("Device group fetch error:", deviceErr);
      return res.status(500).json({
        message: "Database error",
        error: deviceErr.message,
      });
    }

    if (deviceRows.length === 0) {
      return res.status(404).json({
        message: "Device not found",
        deviceId,
      });
    }

    const deviceGroup = deviceRows[0].device_group || "default";

    const firmwareQuery = `
      SELECT *
      FROM firmware_versions
      WHERE is_latest = 1
      AND target_group = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    db.query(firmwareQuery, [deviceGroup], (firmwareErr, firmwareRows) => {
      if (firmwareErr) {
        console.error("Latest firmware fetch error:", firmwareErr);
        return res.status(500).json({
          message: "Database error",
          error: firmwareErr.message,
        });
      }

      if (firmwareRows.length === 0) {
        return res.json({
          updateAvailable: false,
          deviceId,
          currentVersion,
          deviceGroup,
          message: "No latest firmware found for this device group",
        });
      }

      const latestFirmware = firmwareRows[0];
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
            currentVersion !== latestVersion
              ? "UPDATE_AVAILABLE"
              : "UP_TO_DATE";

          const logMessage =
            currentVersion !== latestVersion
              ? `Firmware update available from ${currentVersion} to ${latestVersion} for group ${deviceGroup}`
              : `Device firmware is already up to date for group ${deviceGroup}`;

          const insertLogQuery = `
            INSERT INTO ota_logs 
            (device_id, current_version, target_version, status, message)
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
                  deviceGroup,
                });
              }

              res.json({
                updateAvailable: false,
                deviceId,
                currentVersion,
                latestVersion,
                deviceGroup,
              });
            }
          );
        }
      );
    });
  });
});

module.exports = router;