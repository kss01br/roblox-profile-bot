const { awardMessageXp } = require("../utils/xpManager");

function getAllowedXpChannels() {
  return (process.env.XP_GENERAL_CHANNEL_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

module.exports = async (message) => {
  try {
    if (!message.guild) return;
    if (!message.author || message.author.bot) return;

    const allowedChannels = getAllowedXpChannels();
    if (!allowedChannels.length) return;

    if (!allowedChannels.includes(message.channelId)) return;

    awardMessageXp(message.guild.id, message.author.id);
  } catch (error) {
    console.error("Erro no messageCreateHandler:");
    console.error(error);
  }
};