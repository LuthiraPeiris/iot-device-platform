const axios = require("axios");

const API_URL = "http://localhost:5000/api/devices/heartbeat";

const device = {
  device_id: "esp32-001",
};

async function sendHeartbeat() {
  try {
    const response = await axios.post(API_URL, device);
    console.log(new Date().toLocaleTimeString(), response.data.message);
  } catch (error) {
    console.error("Heartbeat failed:", error.response?.data || error.message);
  }
}

sendHeartbeat();

setInterval(sendHeartbeat, 10000);