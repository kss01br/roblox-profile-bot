const { RANKING_CHANNEL_ID } = require("../config/env");
const { sendOrUpdateRanking } = require("../services/ranking.service");

module.exports = async (client) => {
  console.log(`Bot online como ${client.user.tag}`);

  try {
    await sendOrUpdateRanking(client, RANKING_CHANNEL_ID, 10);
  } catch (error) {
    console.error("Erro ao enviar ranking inicial:");
    console.error(error);
  }

  setInterval(async () => {
    try {
      await sendOrUpdateRanking(client, RANKING_CHANNEL_ID, 10);
    } catch (error) {
      console.error("Erro ao atualizar ranking automático:");
      console.error(error);
    }
  }, 20 * 60 * 1000);
};