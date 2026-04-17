const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getUserByUsername,
  getUserById,
  getAvatarImage,
} = require("../utils/robloxUser");
const { reviewAvatarImage } = require("../services/avatarAiReview");
const {
  getUserUsageToday,
  incrementUserUsage,
} = require("../utils/avatarUsage");

function formatScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.0";
  return num.toFixed(1);
}

function scoreEmoji(score) {
  if (score >= 9.5) return "👑";
  if (score >= 8.5) return "🔥";
  if (score >= 7.0) return "✨";
  if (score >= 5.5) return "👌";
  if (score >= 4.0) return "🙂";
  return "😅";
}

function listText(items, fallback = "Nada relevante.") {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => `• ${item}`).join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avaliaravatar")
    .setDescription("Busca o avatar do perfil Roblox e faz uma avaliação visual com IA")
    .addStringOption((option) =>
      option
        .setName("nick")
        .setDescription("Nome do jogador no Roblox")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("User ID do jogador no Roblox")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("modo")
        .setDescription("Estilo da avaliação")
        .setRequired(false)
        .addChoices(
          { name: "Padrão", value: "padrao" },
          { name: "Rigoroso", value: "rigoroso" },
          { name: "Casual", value: "casual" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const allowedRoleId = process.env.AVATAR_ALLOWED_ROLE_ID;
      const memberRoles = interaction.member?.roles?.cache;

      if (!allowedRoleId) {
        return interaction.editReply("❌ AVATAR_ALLOWED_ROLE_ID não configurado.");
      }

      if (!memberRoles || !memberRoles.has(allowedRoleId)) {
        return interaction.editReply("❌ Você não tem o cargo permitido para usar este comando.");
      }

      const usedToday = getUserUsageToday(interaction.user.id);

      if (usedToday >= 2) {
        return interaction.editReply("❌ Você já usou suas 2 avaliações de hoje.");
      }

      const nick = interaction.options.getString("nick");
      const id = interaction.options.getInteger("id");
      const modo = interaction.options.getString("modo") || "padrao";

      if (!nick && !id) {
        return interaction.editReply("❌ Envie pelo menos um `nick` ou um `id`.");
      }

      let user;

      if (id) {
        user = await getUserById(id);
      } else {
        user = await getUserByUsername(nick);
      }

      const imageUrl = await getAvatarImage(user.userId);

      const review = await reviewAvatarImage({
        imageUrl,
        username: user.username,
        displayName: user.displayName,
        modo,
      });

      const currentUsage = incrementUserUsage(interaction.user.id);
      const c = review.criterios || {};

      const embed = new EmbedBuilder()
        .setTitle(`${scoreEmoji(review.nota_final)} Avaliação Premium do Avatar`)
        .setDescription(
          `**${user.displayName}** (@${user.username})\nID: \`${user.userId}\`\nModo: \`${modo}\`\nUso de hoje: **${currentUsage}/2**\n\n${review.resumo || "Sem resumo."}`
        )
        .setThumbnail(imageUrl)
        .addFields(
          {
            name: "🏆 Nota Final",
            value: `**${formatScore(review.nota_final)}/10**`,
            inline: true,
          },
          {
            name: "🎖️ Rank",
            value: review.rank || "—",
            inline: true,
          },
          {
            name: "🧬 Identidade",
            value: `${formatScore(c.identidade_visual)}/10`,
            inline: true,
          },
          {
            name: "🧩 Coerência",
            value: `${formatScore(c.coerencia_outfit)}/10`,
            inline: true,
          },
          {
            name: "🎨 Cores",
            value: `${formatScore(c.paleta_cores)}/10`,
            inline: true,
          },
          {
            name: "🧠 Criatividade",
            value: `${formatScore(c.criatividade)}/10`,
            inline: true,
          },
          {
            name: "⚡ Presença",
            value: `${formatScore(c.presenca_visual)}/10`,
            inline: true,
          },
          {
            name: "💎 Acabamento",
            value: `${formatScore(c.acabamento)}/10`,
            inline: true,
          },
          {
            name: "⚖️ Equilíbrio",
            value: `${formatScore(c.proporcao_equilibrio)}/10`,
            inline: true,
          },
          {
            name: "✅ Pontos Fortes",
            value: listText(review.pontos_fortes),
            inline: false,
          },
          {
            name: "⚠️ Pontos Fracos",
            value: listText(review.pontos_fracos),
            inline: false,
          },
          {
            name: "🛠️ Sugestão",
            value: review.sugestao || "Sem sugestão.",
            inline: false,
          }
        )
        .setColor(0x8b5cf6)
        .setFooter({
          text: "Análise visual baseada no avatar do perfil Roblox.",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no comando /avaliaravatar:", error);

      const message =
        error?.status === 429 || error?.code === "insufficient_quota"
          ? "❌ A IA está sem quota/saldo no momento."
          : "❌ Deu erro ao avaliar esse avatar.";

      await interaction.editReply(message);
    }
  },
};