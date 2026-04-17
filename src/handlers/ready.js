const { RANKING_CHANNEL_ID } = require("../config/env");
const { sendOrUpdateRanking } = require("../services/ranking.service");
const startMonitorTask = require("../tasks/monitorTask");

module.exports = async (client) => {
  console.log(`Bot online como ${client.user.tag}`);

  startMonitorTask(client);

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
  }, 30 * 1000);
};