const fs = require("fs");
const path = require("path");

const usageFilePath = path.join(__dirname, "..", "data", "avatarUsage.json");

function ensureFileExists() {
  if (!fs.existsSync(usageFilePath)) {
    fs.writeFileSync(usageFilePath, "{}", "utf8");
  }
}

function readUsage() {
  ensureFileExists();
  const raw = fs.readFileSync(usageFilePath, "utf8");
  return JSON.parse(raw || "{}");
}

function writeUsage(data) {
  fs.writeFileSync(usageFilePath, JSON.stringify(data, null, 2), "utf8");
}

function getTodayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getUserUsageToday(userId) {
  const data = readUsage();
  const today = getTodayKey();

  if (!data[today]) return 0;
  return data[today][userId] || 0;
}

function incrementUserUsage(userId) {
  const data = readUsage();
  const today = getTodayKey();

  if (!data[today]) {
    data[today] = {};
  }

  data[today][userId] = (data[today][userId] || 0) + 1;
  writeUsage(data);

  return data[today][userId];
}

module.exports = {
  getUserUsageToday,
  incrementUserUsage,
};