const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getUserXp,
  getRankProgress,
  formatNumber,
} = require("../utils/xpManager");

function makeProgressBar(percent, size = 12) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * size);
  const empty = size - filled;

  return `▰`.repeat(filled) + `▱`.repeat(empty);
}

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
      const targetUser =
        interaction.options.getUser("usuario") || interaction.user;

      const stats = getUserXp(interaction.guildId, targetUser.id);
      const progress = getRankProgress(stats.xp);

      const avatar = targetUser.displayAvatarURL({
        extension: "png",
        size: 256,
      });

      const progressBar = makeProgressBar(progress.progressPercent);

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({
          name: `Perfil Lunar • ${targetUser.username}`,
          iconURL: avatar,
        })
        .setThumbnail(avatar)
        .setDescription(
          [
            `🌠 **Patente atual:** ${progress.currentRank.name}`,
            `✨ **XP total:** ${formatNumber(stats.xp)}`,
          ].join("\n")
        )
        .addFields(
          {
            name: "📈 Progresso",
            value: `${progressBar}\n**${progress.progressPercent.toFixed(1)}%**`,
            inline: false,
          },
          {
            name: "🚀 Próxima patente",
            value: progress.nextRank ? progress.nextRank.name : "Patente máxima",
            inline: true,
          },
          {
            name: "📦 Falta",
            value: progress.nextRank
              ? `${formatNumber(progress.remainingXp)} XP`
              : "0 XP",
            inline: true,
          },
          {
            name: "💬 Mensagens",
            value: formatNumber(stats.messages || 0),
            inline: true,
          },
          {
            name: "🎧 Tempo em call",
            value: `${formatNumber(stats.voiceMinutes || 0)} min`,
            inline: true,
          }
        )
        .setFooter({
          text: "Sistema Lunar XP",
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: 64,
      });
    } catch (error) {
      console.error("Erro ao executar o comando rank:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: "❌ Ocorreu um erro ao mostrar o perfil lunar.",
            flags: 64,
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