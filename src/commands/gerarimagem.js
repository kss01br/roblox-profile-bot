const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const OpenAI = require("openai");
const {
  getUserUsageToday,
  incrementUserUsage,
} = require("../utils/imageUsage");

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não definida.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gerarimagem")
    .setDescription("Gera uma imagem em boa qualidade")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Descreva a imagem que deseja gerar")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const allowedRoleId = process.env.IMAGE_ALLOWED_ROLE_ID;
      const memberRoles = interaction.member?.roles?.cache;

      if (!allowedRoleId) {
        return interaction.editReply("❌ IMAGE_ALLOWED_ROLE_ID não configurado.");
      }

      if (!memberRoles || !memberRoles.has(allowedRoleId)) {
        return interaction.editReply("❌ Você não tem o cargo permitido para usar este comando.");
      }

      const usedToday = getUserUsageToday(interaction.user.id);

      if (usedToday >= 2) {
        return interaction.editReply("❌ Você já usou suas 2 gerações de hoje.");
      }

      const prompt = interaction.options.getString("prompt", true);

      const openai = getOpenAI();

      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "medium",
      });

      const imageBase64 = result?.data?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error("A API não retornou imagem.");
      }

      const buffer = Buffer.from(imageBase64, "base64");

      const currentUsage = incrementUserUsage(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle("🖼️ Imagem gerada")
        .setDescription(
          `Uso de hoje: **${currentUsage}/2**\nPrompt: ${prompt.slice(0, 900)}`
        )
        .setColor(0x5865f2)
        .setImage("attachment://imagem.png")
        .setFooter({
          text: `Solicitado por ${interaction.user.username}`,
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [
          {
            attachment: buffer,
            name: "imagem.png",
          },
        ],
      });
    } catch (error) {
      console.error("Erro no comando /gerarimagem:", error);

      const isQuotaError =
        error?.status === 429 || error?.code === "insufficient_quota";

      await interaction.editReply(
        isQuotaError
          ? "❌ A API de imagem está sem saldo/quota no momento."
          : "❌ Deu erro ao gerar a imagem."
      );
    }
  },
};