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
  const { version } = req.body;

  if (!version) {
    return res.status(400).json({ error: "Firmware version is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Firmware file is required" });
  }

  const fileName = req.file.filename;
  const fileUrl = `http://192.168.8.108:5000/firmware/${fileName}`;

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
      (version, file_name, file_url, is_latest) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [version, fileName, fileUrl, 1], (error, result) => {
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

module.exports = router;