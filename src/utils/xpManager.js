const fs = require("fs");
const path = require("path");
const lunarRanks = require("../data/lunarRanks");

const dataDir = path.join(__dirname, "..", "data");
const xpFilePath = path.join(dataDir, "xp.json");

const cooldowns = new Map();

function ensureXpFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(xpFilePath)) {
    fs.writeFileSync(xpFilePath, JSON.stringify({}, null, 2), "utf8");
  }
}

function readXpData() {
  ensureXpFile();
  const raw = fs.readFileSync(xpFilePath, "utf8");
  return JSON.parse(raw || "{}");
}

function writeXpData(data) {
  ensureXpFile();
  fs.writeFileSync(xpFilePath, JSON.stringify(data, null, 2), "utf8");
}

function ensureUser(data, guildId, userId) {
  if (!data[guildId]) {
    data[guildId] = {};
  }

  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      xp: 0,
      messages: 0,
      updatedAt: Date.now(),
    };
  }
}

function getRandomXpGain() {
  const min = Number(process.env.XP_MIN_GAIN || 15);
  const max = Number(process.env.XP_MAX_GAIN || 25);

  const safeMin = Number.isFinite(min) ? min : 15;
  const safeMax = Number.isFinite(max) ? max : 25;

  const low = Math.min(safeMin, safeMax);
  const high = Math.max(safeMin, safeMax);

  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getCooldownSeconds() {
  const seconds = Number(process.env.XP_COOLDOWN_SECONDS || 30);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 30;
}

function canGainXp(guildId, userId) {
  const cooldownMs = getCooldownSeconds() * 1000;
  const key = `${guildId}:${userId}`;
  const last = cooldowns.get(key);

  if (!last) return true;
  return Date.now() - last >= cooldownMs;
}

function markCooldown(guildId, userId) {
  const key = `${guildId}:${userId}`;
  cooldowns.set(key, Date.now());
}

function addXp(guildId, userId, amount) {
  const data = readXpData();

  ensureUser(data, guildId, userId);

  data[guildId][userId].xp += amount;
  data[guildId][userId].messages += 1;
  data[guildId][userId].updatedAt = Date.now();

  writeXpData(data);

  return data[guildId][userId];
}

function awardMessageXp(guildId, userId) {
  if (!canGainXp(guildId, userId)) {
    return null;
  }

  const xpGain = getRandomXpGain();
  const userData = addXp(guildId, userId, xpGain);

  markCooldown(guildId, userId);

  return {
    xpGain,
    userData,
  };
}

function getUserXp(guildId, userId) {
  const data = readXpData();

  if (!data[guildId] || !data[guildId][userId]) {
    return {
      xp: 0,
      messages: 0,
      updatedAt: null,
    };
  }

  return data[guildId][userId];
}

function getCurrentRank(xp) {
  let currentRank = lunarRanks[0];

  for (const rank of lunarRanks) {
    if (xp >= rank.minXp) {
      currentRank = rank;
    } else {
      break;
    }
  }

  return currentRank;
}

function getNextRank(xp) {
  for (const rank of lunarRanks) {
    if (xp < rank.minXp) {
      return rank;
    }
  }

  return null;
}

function getRankProgress(xp) {
  const currentRank = getCurrentRank(xp);
  const nextRank = getNextRank(xp);

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progressPercent: 100,
      currentBaseXp: currentRank.minXp,
      nextBaseXp: currentRank.minXp,
      remainingXp: 0,
    };
  }

  const currentBaseXp = currentRank.minXp;
  const nextBaseXp = nextRank.minXp;
  const range = nextBaseXp - currentBaseXp;
  const progressed = xp - currentBaseXp;
  const progressPercent = range > 0 ? Math.max(0, Math.min(100, (progressed / range) * 100)) : 100;

  return {
    currentRank,
    nextRank,
    progressPercent,
    currentBaseXp,
    nextBaseXp,
    remainingXp: nextBaseXp - xp,
  };
}

function getGuildRanking(guildId, limit = 10) {
  const data = readXpData();
  const guildData = data[guildId] || {};

  return Object.entries(guildData)
    .map(([userId, stats]) => ({
      userId,
      xp: stats.xp || 0,
      messages: stats.messages || 0,
      updatedAt: stats.updatedAt || null,
      rank: getCurrentRank(stats.xp || 0),
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

module.exports = {
  awardMessageXp,
  getUserXp,
  getCurrentRank,
  getNextRank,
  getRankProgress,
  getGuildRanking,
  formatNumber,
};