const fs = require("fs");
const path = require("path");

const xpFilePath = path.join(__dirname, "..", "data", "xp.json");

function ensureXpFileExists() {
  if (!fs.existsSync(xpFilePath)) {
    fs.mkdirSync(path.dirname(xpFilePath), { recursive: true });
    fs.writeFileSync(xpFilePath, "{}", "utf8");
  }
}

function readXpData() {
  ensureXpFileExists();

  try {
    const raw = fs.readFileSync(xpFilePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Erro ao ler xp.json no voiceXpLoop:", error);
    return {};
  }
}

function writeXpData(data) {
  ensureXpFileExists();
  fs.writeFileSync(xpFilePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeUserEntry(entry) {
  if (typeof entry === "number") {
    return {
      xp: entry,
      messages: 0,
      voiceMinutes: 0,
      updatedAt: null,
    };
  }

  if (entry && typeof entry === "object") {
    return {
      xp: entry.xp || 0,
      messages: entry.messages || 0,
      voiceMinutes: entry.voiceMinutes || 0,
      updatedAt: entry.updatedAt || null,
    };
  }

  return {
    xp: 0,
    messages: 0,
    voiceMinutes: 0,
    updatedAt: null,
  };
}

function startVoiceXpLoop(client) {
  console.log("🎧 Voice XP loop iniciado");

  setInterval(() => {
    try {
      const xpData = readXpData();
      const voiceXpGain = 2;

      for (const guild of client.guilds.cache.values()) {
        for (const voiceChannel of guild.channels.cache.values()) {
          if (!voiceChannel.isVoiceBased?.()) continue;

          for (const [memberId, member] of voiceChannel.members) {
            if (!member || member.user.bot) continue;

            const voice = member.voice;
            if (!voice || voice.selfMute || voice.serverMute) continue;

            const currentEntry = normalizeUserEntry(xpData[memberId]);

            currentEntry.xp += voiceXpGain;
            currentEntry.voiceMinutes += 1;
            currentEntry.updatedAt = Date.now();

            xpData[memberId] = currentEntry;

            console.log(
              `🎧 ${member.user.tag} ganhou ${voiceXpGain} XP por voz. Total: ${currentEntry.xp} | Call: ${currentEntry.voiceMinutes} min`
            );
          }
        }
      }

      writeXpData(xpData);
    } catch (error) {
      console.error("Erro no loop de XP por voz:", error);
    }
  }, 60 * 1000);
}

module.exports = startVoiceXpLoop;