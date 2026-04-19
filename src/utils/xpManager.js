const fs = require("fs");
const path = require("path");
const lunarRanks = require("../data/lunarRanks");

const dataDir = path.join(__dirname, "..", "data");
const xpFilePath = path.join(dataDir, "xp.json");

const textCooldowns = new Map();

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

  try {
    const raw = fs.readFileSync(xpFilePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Erro ao ler xp.json:", error);
    return {};
  }
}

function writeXpData(data) {
  ensureXpFile();
  fs.writeFileSync(xpFilePath, JSON.stringify(data, null, 2), "utf8");
}

function isFlatUserEntry(entry) {
  return (
    typeof entry === "number" ||
    (entry &&
      typeof entry === "object" &&
      ("xp" in entry ||
        "totalXp" in entry ||
        "experience" in entry ||
        "points" in entry))
  );
}

function getEntryXp(entry) {
  if (typeof entry === "number") return entry;
  if (!entry || typeof entry !== "object") return 0;

  return entry.xp || entry.totalXp || entry.experience || entry.points || 0;
}

function getEntryMessages(entry) {
  if (!entry || typeof entry !== "object") return 0;
  return entry.messages || 0;
}

function getEntryVoiceMinutes(entry) {
  if (!entry || typeof entry !== "object") return 0;
  return entry.voiceMinutes || 0;
}

function getEntryUpdatedAt(entry) {
  if (!entry || typeof entry !== "object") return null;
  return entry.updatedAt || null;
}

function ensureUser(data, guildId, userId) {
  if (!data[guildId] || typeof data[guildId] !== "object" || isFlatUserEntry(data[guildId])) {
    data[guildId] = {};
  }

  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      xp: 0,
      messages: 0,
      voiceMinutes: 0,
      updatedAt: Date.now(),
    };
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function getTextCooldownSeconds() {
  const seconds = Number(process.env.XP_TEXT_COOLDOWN_SECONDS || 30);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 30;
}

function getRandomTextXp() {
  const min = Number(process.env.XP_TEXT_MIN_GAIN || 15);
  const max = Number(process.env.XP_TEXT_MAX_GAIN || 25);

  const safeMin = Number.isFinite(min) ? min : 15;
  const safeMax = Number.isFinite(max) ? max : 25;

  const low = Math.min(safeMin, safeMax);
  const high = Math.max(safeMin, safeMax);

  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function getVoiceXpPerMinute() {
  const value = Number(process.env.XP_VOICE_PER_MINUTE || 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function getTextCooldownKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function canGainTextXp(guildId, userId) {
  const key = getTextCooldownKey(guildId, userId);
  const last = textCooldowns.get(key);

  if (!last) return true;

  return Date.now() - last >= getTextCooldownSeconds() * 1000;
}

function markTextCooldown(guildId, userId) {
  const key = getTextCooldownKey(guildId, userId);
  textCooldowns.set(key, Date.now());
}

function addXp(guildId, userId, amount, meta = {}) {
  const data = readXpData();

  ensureUser(data, guildId, userId);

  data[guildId][userId].xp += amount;
  data[guildId][userId].updatedAt = Date.now();

  if (meta.messageIncrement) {
    data[guildId][userId].messages += meta.messageIncrement;
  }

  if (meta.voiceMinutesIncrement) {
    data[guildId][userId].voiceMinutes += meta.voiceMinutesIncrement;
  }

  writeXpData(data);

  return data[guildId][userId];
}

function awardTextXp(guildId, userId) {
  if (!canGainTextXp(guildId, userId)) {
    return null;
  }

  const xpGain = getRandomTextXp();
  const userData = addXp(guildId, userId, xpGain, { messageIncrement: 1 });

  markTextCooldown(guildId, userId);

  return {
    xpGain,
    userData,
  };
}

function awardVoiceXp(guildId, userId, minutes = 1) {
  const xpPerMinute = getVoiceXpPerMinute();
  const amount = xpPerMinute * minutes;

  return addXp(guildId, userId, amount, {
    voiceMinutesIncrement: minutes,
  });
}

function getUserXp(guildId, userId) {
  const data = readXpData();

  if (data[guildId] && data[guildId][userId]) {
    const entry = data[guildId][userId];

    return {
      xp: getEntryXp(entry),
      messages: getEntryMessages(entry),
      voiceMinutes: getEntryVoiceMinutes(entry),
      updatedAt: getEntryUpdatedAt(entry),
    };
  }

  if (data[userId] !== undefined) {
    const entry = data[userId];

    return {
      xp: getEntryXp(entry),
      messages: getEntryMessages(entry),
      voiceMinutes: getEntryVoiceMinutes(entry),
      updatedAt: getEntryUpdatedAt(entry),
    };
  }

  return {
    xp: 0,
    messages: 0,
    voiceMinutes: 0,
    updatedAt: null,
  };
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
      remainingXp: 0,
    };
  }

  const span = nextRank.minXp - currentRank.minXp;
  const progressed = xp - currentRank.minXp;
  const progressPercent =
    span > 0 ? Math.max(0, Math.min(100, (progressed / span) * 100)) : 100;

  return {
    currentRank,
    nextRank,
    progressPercent,
    remainingXp: nextRank.minXp - xp,
  };
}

function getGuildRanking(guildId, limit = 10) {
  const data = readXpData();

  if (data[guildId] && typeof data[guildId] === "object" && !isFlatUserEntry(data[guildId])) {
    const guildData = data[guildId] || {};

    return Object.entries(guildData)
      .map(([userId, stats]) => ({
        userId,
        xp: getEntryXp(stats),
        rank: getCurrentRank(getEntryXp(stats)),
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  return Object.entries(data)
    .filter(([, entry]) => isFlatUserEntry(entry))
    .map(([userId, stats]) => ({
      userId,
      xp: getEntryXp(stats),
      rank: getCurrentRank(getEntryXp(stats)),
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

module.exports = {
  awardTextXp,
  awardVoiceXp,
  getUserXp,
  getCurrentRank,
  getNextRank,
  getRankProgress,
  getGuildRanking,
  formatNumber,
};