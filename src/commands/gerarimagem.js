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

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBlockedReason(text) {
  const normalized = normalizeText(text);

  const rules = [
    {
      reason: "conteúdo sexual explícito",
      terms: [
        "sexo",
        "sexual",
        "nude",
        "nu",
        "pelado",
        "pelada",
        "porn",
        "porno",
        "boquete",
        "oral",
        "fetiche",
        "onlyfans",
      ],
    },
    {
      reason: "violência gráfica",
      terms: [
        "gore",
        "tripas",
        "decapitado",
        "decapitada",
        "mutilado",
        "mutilada",
        "sangue jorrando",
        "cadaver aberto",
      ],
    },
    {
      reason: "conteúdo envolvendo menores",
      terms: [
        "menor de idade",
        "crianca sexualizada",
        "adolescente nua",
        "adolescente pelada",
        "loli",
      ],
    },
    {
      reason: "ódio ou extremismo",
      terms: [
        "nazista",
        "hitler",
        "supremacia racial",
        "kkk",
      ],
    },
    {
      reason: "autolesão",
      terms: [
        "automutilacao",
        "suicidio",
        "se cortando",
        "se matar",
      ],
    },
    {
      reason: "atividade perigosa ou ilegal",
      terms: [
        "cocaina",
        "crack",
        "heroina",
        "metanfetamina",
        "arma caseira",
        "bomba caseira",
      ],
    },
  ];

  for (const rule of rules) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      return rule.reason;
    }
  }

  return null;
}

function buildSafePrompt(userPrompt) {
  return `
Você gera imagens de forma segura e apropriada.

Regras obrigatórias:
- Não gere nudez explícita ou conteúdo sexual explícito.
- Não gere violência gráfica, mutilação, gore ou sangue excessivo.
- Não gere conteúdo envolvendo menores de forma inadequada.
- Não gere conteúdo de ódio, extremismo ou humilhação direcionada.
- Não gere instruções visuais para crimes, drogas, armas ou atividades perigosas.
- Se o pedido for ambíguo, transforme em uma versão segura e neutra.
- Priorize resultado visual bonito, detalhado e coerente.
- Gere apenas uma imagem.

Pedido do usuário:
${userPrompt}
`.trim();
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

      const prompt = interaction.options.getString("prompt", true).trim();

      if (prompt.length < 5) {
        return interaction.editReply("❌ Escreva um prompt um pouco mais detalhado.");
      }

      const blockedReason = getBlockedReason(prompt);
      if (blockedReason) {
        console.log(`[BLOQUEADO] ${interaction.user.tag}: ${prompt}`);
        return interaction.editReply(`❌ Pedido bloqueado por envolver ${blockedReason}.`);
      }

      const usedToday = getUserUsageToday(interaction.user.id);

      if (usedToday >= 2) {
        return interaction.editReply("❌ Você já usou suas 2 gerações de hoje.");
      }

      const openai = getOpenAI();
      const finalPrompt = buildSafePrompt(prompt);

      const result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: "1024x1024",
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