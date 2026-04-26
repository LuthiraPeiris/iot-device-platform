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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

