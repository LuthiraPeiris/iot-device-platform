const axios = require("axios");

const BASE_URL = "http://localhost:5000/api/devices";

const deviceId = "esp32-001";

function generateTelemetry() {
  return {
    device_id: deviceId,
    temperature: Number((25 + Math.random() * 8).toFixed(2)),
    battery: Math.floor(60 + Math.random() * 40),
    wifi_signal: Math.floor(-75 + Math.random() * 25),
  };
}

async function sendHeartbeat() {
  try {
    const response = await axios.post(`${BASE_URL}/heartbeat`, {
      device_id: deviceId,
    });

    console.log(new Date().toLocaleTimeString(), response.data.message);
  } catch (error) {
    console.error("Heartbeat failed:", error.response?.data || error.message);
  }
}

async function sendTelemetry() {
  try {
    const telemetry = generateTelemetry();

    const response = await axios.post(`${BASE_URL}/telemetry`, telemetry);

    console.log("Telemetry sent:", telemetry);
    console.log(response.data.message);
  } catch (error) {
    console.error("Telemetry failed:", error.response?.data || error.message);
  }
}

async function runDevice() {
  await sendHeartbeat();
  await sendTelemetry();
}

runDevice();

setInterval(runDevice, 10000);