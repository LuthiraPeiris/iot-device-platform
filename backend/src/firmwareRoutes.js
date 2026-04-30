const express = require("express");
const router = express.Router();
const db = require("./db");

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