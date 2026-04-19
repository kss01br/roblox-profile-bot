const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Mostra a central de ajuda do Bot Lunar"),

  async execute(interaction) {
    try {
      const botAvatar = interaction.client.user.displayAvatarURL({
        extension: "png",
        size: 256,
      });

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({
          name: "🌙 Central de Ajuda • Bot Lunar",
          iconURL: botAvatar,
        })
        .setThumbnail(botAvatar)
        .setTitle("Comandos disponíveis")
        .setDescription(
          [
            "Bem-vindo à **central lunar** do servidor.",
            "Aqui você encontra os principais comandos do bot, organizados por categoria.",
            "",
            "🌠 **Perfil Lunar:** acompanhe seu XP, patente e posição geral.",
            "🎮 **Roblox:** consulte perfis, avatares e o top dos mapas monitorados.",
            "🃏 **Diversão:** aproveite os comandos interativos do servidor.",
          ].join("\n")
        )
        .addFields(
          {
            name: "🏆 XP e Perfil",
            value: [
              "`/rank` → Mostra seu perfil lunar ou o de outro usuário",
              "`/rankingxp` → Exibe o ranking de XP do servidor",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🎮 Roblox",
            value: [
              "`/roblox` → Mostra informações do perfil Roblox",
              "`/ranking` → Mostra o top 10 dos mapas Roblox monitorados",
              "`/avaliaravatar` → Faz uma avaliação do avatar",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🖼️ Imagens",
            value: "`/gerarimagem` → Gera imagem com IA",
            inline: false,
          },
          {
            name: "📡 Monitoramento",
            value: [
              "`/monitorar` → Inicia o monitoramento",
              "`/pararmonitoramento` → Encerra o monitoramento ativo",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🃏 Diversão",
            value: "`/truco` → Inicia ou gerencia uma partida de truco",
            inline: false,
          },
          {
            name: "✨ Extra",
            value: "`/ajuda` → Abre esta central de ajuda",
            inline: false,
          }
        )
        .setFooter({
          text: "Bot Lunar • KS",
          iconURL: botAvatar,
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Erro ao executar o comando ajuda:", error);

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: "❌ Ocorreu um erro ao abrir a central de ajuda.",
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: "❌ Ocorreu um erro ao abrir a central de ajuda.",
          })
          .catch(() => {});
      }
    }
  },
};