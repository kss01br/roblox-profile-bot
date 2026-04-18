const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const statsFilePath = path.join(dataDir, "trucoStats.json");

function ensureStatsFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(statsFilePath)) {
    fs.writeFileSync(statsFilePath, JSON.stringify({}, null, 2), "utf8");
  }
}

function readStats() {
  ensureStatsFile();
  const raw = fs.readFileSync(statsFilePath, "utf8");
  return JSON.parse(raw || "{}");
}

function writeStats(data) {
  ensureStatsFile();
  fs.writeFileSync(statsFilePath, JSON.stringify(data, null, 2), "utf8");
}

function ensurePlayer(stats, userId) {
  if (!stats[userId]) {
    stats[userId] = {
      wins: 0,
      losses: 0,
      matches: 0,
    };
  }
}

function recordMatchResult(winnerId, loserId) {
  const stats = readStats();

  ensurePlayer(stats, winnerId);
  ensurePlayer(stats, loserId);

  stats[winnerId].wins += 1;
  stats[winnerId].matches += 1;

  stats[loserId].losses += 1;
  stats[loserId].matches += 1;

  writeStats(stats);
}

module.exports = {
  recordMatchResult,
  readStats,
};