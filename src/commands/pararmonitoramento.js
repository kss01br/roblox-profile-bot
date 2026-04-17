const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const {
  removeMonitor,
  clearMonitor,
} = require("../utils/monitorStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pararmonitoramento")
    .setDescription("Para de monitorar um jogador ou todos")
    .addStringOption((option) =>
      option
        .setName("nick")
        .setDescription("Nome do jogador para parar (opcional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const allowedRoleId = process.env.MONITOR_ALLOWED_ROLE_ID;
      const memberRoles = interaction.member?.roles?.cache;

      if (!allowedRoleId) {
        return interaction.editReply("❌ MONITOR_ALLOWED_ROLE_ID não configurado.");
      }

      if (!memberRoles || !memberRoles.has(allowedRoleId)) {
        return interaction.editReply("❌ Você não tem o cargo permitido para usar este comando.");
      }

      const nick = interaction.options.getString("nick");

      if (!nick) {
        clearMonitor(interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor(0xff4d4d)
          .setTitle("🛑 Monitoramento encerrado")
          .setDescription("Todos os jogadores foram removidos do monitoramento.")
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      const list = removeMonitor(interaction.user.id, nick);

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("🛑 Monitor atualizado")
        .setDescription(
          list.length > 0
            ? `Removido: **${nick}**\n\nAinda monitorando:\n${list
                .map((p) => `• ${p.username}`)
                .join("\n")}`
            : `Removido: **${nick}**\n\nVocê não está mais monitorando ninguém.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no /pararmonitoramento:", error);
      await interaction.editReply("❌ Erro ao parar monitoramento.");
    }
  },
};