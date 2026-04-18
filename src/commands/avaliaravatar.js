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
      console.log("=== /avaliaravatar iniciado ===");
      console.log("Usuário Discord:", interaction.user.username, interaction.user.id);

      const nick = interaction.options.getString("nick");
      const id = interaction.options.getInteger("id");
      const modo = interaction.options.getString("modo") || "padrao";

      console.log("Nick recebido:", nick);
      console.log("ID recebido:", id);
      console.log("Modo recebido:", modo);

      if (!nick && !id) {
        return await interaction.editReply("❌ Envie pelo menos um `nick` ou um `id`.");
      }

      // TESTE TEMPORÁRIO:
      // cargo desativado pra descobrir o erro principal
      // Quando tudo estiver funcionando, a gente liga isso de novo.

      /*
      const allowedRoleId = process.env.AVATAR_ALLOWED_ROLE_ID;
      const memberRoles = interaction.member?.roles?.cache;

      if (!allowedRoleId) {
        return await interaction.editReply("❌ AVATAR_ALLOWED_ROLE_ID não configurado.");
      }

      if (!memberRoles || !memberRoles.has(allowedRoleId)) {
        return await interaction.editReply("❌ Você não tem o cargo permitido para usar este comando.");
      }
      */

      // TESTE TEMPORÁRIO:
      // limite diário desativado pra não atrapalhar os testes
      /*
      const usedToday = getUserUsageToday(interaction.user.id);
      console.log("Usos hoje:", usedToday);

      if (usedToday >= 2) {
        return await interaction.editReply("❌ Você já usou suas 2 avaliações de hoje.");
      }
      */

      let user;

      if (id) {
        console.log("Buscando usuário por ID...");
        user = await getUserById(id);
      } else {
        console.log("Buscando usuário por nick...");
        user = await getUserByUsername(nick);
      }

      console.log("Usuário Roblox encontrado:", user);

      if (!user || !user.userId) {
        return await interaction.editReply("❌ Não consegui encontrar esse usuário no Roblox.");
      }

      const imageUrl = await getAvatarImage(user.userId);
      console.log("Avatar URL:", imageUrl);

      if (!imageUrl) {
        return await interaction.editReply("❌ Não consegui obter a imagem do avatar.");
      }

      console.log("Enviando avatar para a IA...");
      const review = await reviewAvatarImage({
        imageUrl,
        username: user.username,
        displayName: user.displayName,
        modo,
      });

      console.log("Review IA:", JSON.stringify(review, null, 2));

      if (!review || typeof review !== "object") {
        return await interaction.editReply("❌ A IA não retornou uma avaliação válida.");
      }

      const c = review.criterios || {};

      // TESTE TEMPORÁRIO:
      // não incrementa uso diário durante os testes
      const currentUsage = 0;

      const embed = new EmbedBuilder()
        .setTitle(`${scoreEmoji(review.nota_final)} Avaliação Premium do Avatar`)
        .setDescription(
          `**${user.displayName || user.username}** (@${user.username || "desconhecido"})\n` +
            `ID: \`${user.userId}\`\n` +
            `Modo: \`${modo}\`\n` +
            `Uso de hoje: **${currentUsage}/2**\n\n` +
            `${review.resumo || "Sem resumo."}`
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
      console.log("=== /avaliaravatar finalizado com sucesso ===");
    } catch (error) {
      console.error("Erro no comando /avaliaravatar:", error);

      const message =
        error?.status === 429 || error?.code === "insufficient_quota"
          ? "❌ A IA está sem quota/saldo no momento."
          : error?.message
          ? `❌ Erro: ${error.message}`
          : "❌ Deu erro ao avaliar esse avatar.";

      await interaction.editReply(message).catch(() => {});
    }
  },
};