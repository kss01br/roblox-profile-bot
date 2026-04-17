const { SlashCommandBuilder } = require("discord.js");
const { getUserByUsername } = require("../utils/robloxUser");
const { addMonitor } = require("../utils/monitorStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monitorar")
    .setDescription("Monitora presença de um jogador Roblox")
    .addStringOption(option =>
      option.setName("nick")
        .setDescription("Nome do jogador")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const nick = interaction.options.getString("nick");

      const user = await getUserByUsername(nick);

      const list = addMonitor(interaction.user.id, {
        robloxUserId: user.userId,
        username: user.username
      });

      const textList = list.map((p, i) => `${i + 1}. ${p.username}`).join("\n");

      await interaction.editReply(
        `👁️ Monitorando: **${user.username}**\n\n📌 Seus monitoramentos:\n${textList}\n\n⚠️ Limite: 2 jogadores`
      );

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao monitorar jogador.");
    }
  }
};