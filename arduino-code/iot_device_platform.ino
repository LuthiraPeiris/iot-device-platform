#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ArduinoJson.h>

const char* ssid = "Kavi";
const char* password = "A26YT15842R";

const String DEVICE_ID = "esp32-001";
const String FIRMWARE_VERSION = "1.0.1";

const String SERVER_BASE_URL = "http://192.168.8.107:5000";
const String BASE_URL = SERVER_BASE_URL + "/api/devices";

#define LED_PIN 2

unsigned long lastSendTime = 0;
unsigned long lastCommandCheckTime = 0;

const unsigned long sendInterval = 10000;
const unsigned long commandCheckInterval = 3000;

String getLedStatus() {
  if (digitalRead(LED_PIN) == HIGH) {
    return "ON";
  } else {
    return "OFF";
  }
}

void acknowledgeCommand(int commandId);
void checkCommand();
void sendHeartbeat();
void sendTelemetry();
void checkForFirmwareUpdate();

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  Serial.print("Firmware Version: ");
  Serial.println(FIRMWARE_VERSION);

  sendHeartbeat();
  checkForFirmwareUpdate();
}

void sendHeartbeat() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = BASE_URL + "/heartbeat";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String body = "{";
    body += "\"device_id\":\"" + DEVICE_ID + "\",";
    body += "\"firmware_version\":\"" + FIRMWARE_VERSION + "\"";
    body += "}";

    int httpResponseCode = http.POST(body);

    Serial.print("Heartbeat response code: ");
    Serial.println(httpResponseCode);
    Serial.println(http.getString());

    http.end();
  }
}

void sendTelemetry() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = BASE_URL + "/telemetry";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    float temperature = random(250, 330) / 10.0;
    int battery = random(60, 100);
    int wifiSignal = WiFi.RSSI();
    String ledStatus = getLedStatus();

    String body = "{";
    body += "\"device_id\":\"" + DEVICE_ID + "\",";
    body += "\"temperature\":" + String(temperature) + ",";
    body += "\"battery\":" + String(battery) + ",";
    body += "\"wifi_signal\":" + String(wifiSignal) + ",";
    body += "\"led_status\":\"" + ledStatus + "\",";
    body += "\"firmware_version\":\"" + FIRMWARE_VERSION + "\"";
    body += "}";

    int httpResponseCode = http.POST(body);

    Serial.print("Telemetry response code: ");
    Serial.println(httpResponseCode);
    Serial.println(http.getString());

    http.end();
  }
}

void acknowledgeCommand(int commandId) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = BASE_URL + "/command/ack";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String body = "{\"command_id\":" + String(commandId) + "}";

    int httpResponseCode = http.POST(body);

    Serial.print("ACK response code: ");
    Serial.println(httpResponseCode);
    Serial.println(http.getString());

    http.end();
  }
}

void checkCommand() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = BASE_URL + "/command/" + DEVICE_ID;
    http.begin(url);

    int httpResponseCode = http.GET();

    Serial.print("Command check response code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode == 200) {
      String response = http.getString();
      Serial.println(response);

      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        if (!doc["command"].isNull()) {
          int commandId = doc["id"];
          String command = doc["command"];

          Serial.print("Received command: ");
          Serial.println(command);

          if (command == "LED_ON") {
            digitalWrite(LED_PIN, HIGH);
            Serial.println("LED turned ON");
            acknowledgeCommand(commandId);
          } else if (command == "LED_OFF") {
            digitalWrite(LED_PIN, LOW);
            Serial.println("LED turned OFF");
            acknowledgeCommand(commandId);
          }
        } else {
          Serial.println("No pending command");
        }
      } else {
        Serial.println("JSON parse failed");
      }
    }

    http.end();
  }
}

void checkForFirmwareUpdate() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Skipping OTA check.");
    return;
  }

  HTTPClient http;

  String url =
    SERVER_BASE_URL +
    "/api/firmware/check/" +
    DEVICE_ID +
    "?version=" +
    FIRMWARE_VERSION;

  Serial.println("Checking firmware update...");
  Serial.println(url);

  http.begin(url);

  int httpResponseCode = http.GET();

  Serial.print("Firmware check response code: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println(response);

    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (error) {
      Serial.print("Firmware JSON parse failed: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }

    bool updateAvailable = doc["updateAvailable"];

    if (updateAvailable) {
      String firmwareUrl = doc["firmwareUrl"];
      String latestVersion = doc["latestVersion"];

      Serial.println("New firmware available!");
      Serial.print("Current version: ");
      Serial.println(FIRMWARE_VERSION);
      Serial.print("Latest version: ");
      Serial.println(latestVersion);
      Serial.print("Firmware URL: ");
      Serial.println(firmwareUrl);

      http.end();

      WiFiClient client;

      Serial.println("Starting OTA update...");

      t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);

      switch (ret) {
        case HTTP_UPDATE_FAILED:
          Serial.printf(
            "OTA failed. Error (%d): %s\n",
            httpUpdate.getLastError(),
            httpUpdate.getLastErrorString().c_str()
          );
          break;

        case HTTP_UPDATE_NO_UPDATES:
          Serial.println("No OTA update available.");
          break;

        case HTTP_UPDATE_OK:
          Serial.println("OTA update successful. Rebooting...");
          break;
      }
    } else {
      Serial.println("Firmware is already up to date.");
      http.end();
    }
  } else {
    Serial.print("Firmware check failed: ");
    Serial.println(httpResponseCode);
    Serial.println(http.getString());
    http.end();
  }
}

void loop() {
  unsigned long currentTime = millis();

  if (currentTime - lastSendTime >= sendInterval) {
    sendHeartbeat();
    sendTelemetry();
    lastSendTime = currentTime;
  }

  if (currentTime - lastCommandCheckTime >= commandCheckInterval) {
    checkCommand();
    lastCommandCheckTime = currentTime;
  }
}