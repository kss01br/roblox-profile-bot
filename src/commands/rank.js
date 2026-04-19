const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getUserXp,
  getRankProgress,
  formatNumber,
} = require("../utils/xpManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Mostra seu rank lunar ou o de outro usuário")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuário para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const targetUser =
        interaction.options.getUser("usuario") || interaction.user;

      const stats = getUserXp(interaction.guildId, targetUser.id);
      const progress = getRankProgress(stats.xp);

      const embed = new EmbedBuilder()
        .setTitle("🌌 Perfil Lunar")
        .setDescription(`**Usuário:** ${targetUser}`)
        .addFields(
          {
            name: "XP total",
            value: formatNumber(stats.xp),
            inline: true,
          },
          {
            name: "Patente atual",
            value: progress.currentRank.name,
            inline: true,
          }
        )
        .setColor(0x5865f2)
        .setTimestamp();

      if (progress.nextRank) {
        embed.addFields(
          {
            name: "Próxima patente",
            value: progress.nextRank.name,
            inline: false,
          },
          {
            name: "Falta",
            value: `${formatNumber(progress.remainingXp)} XP`,
            inline: true,
          },
          {
            name: "Progresso",
            value: `${progress.progressPercent.toFixed(1)}%`,
            inline: true,
          }
        );
      } else {
        embed.addFields({
          name: "Status",
          value: "🌠 Patente máxima alcançada",
          inline: false,
        });
      }

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Erro ao executar o comando rank:", error);

      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply({
            content: "❌ Ocorreu um erro ao mostrar o perfil lunar.",
            embeds: [],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Ocorreu um erro ao mostrar o perfil lunar.",
            flags: 64,
          })
          .catch(() => {});
      }
    }
  },
};