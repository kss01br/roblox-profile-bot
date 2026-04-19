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

            const currentEntry = xpData[memberId];

            if (typeof currentEntry === "number") {
              xpData[memberId] = currentEntry + voiceXpGain;
            } else if (currentEntry && typeof currentEntry === "object") {
              xpData[memberId].xp = (currentEntry.xp || 0) + voiceXpGain;
            } else {
              xpData[memberId] = voiceXpGain;
            }

            const totalXp =
              typeof xpData[memberId] === "number"
                ? xpData[memberId]
                : xpData[memberId].xp || 0;

            console.log(
              `🎧 ${member.user.tag} ganhou ${voiceXpGain} XP por voz. Total: ${totalXp}`
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