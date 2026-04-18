const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getGame,
  findPlayerKey,
  formatHand,
} = require("../games/trucoManager");

function buildPublicGameEmbed(game) {
  return new EmbedBuilder()
    .setTitle("🃏 Truco Lunar")
    .setDescription(
      `**Status:** ${game.status === "playing" ? "Em andamento" : "Aguardando aceite"}\n\n` +
        `**${game.players.p1.name}** ${game.score.p1} x ${game.score.p2} **${game.players.p2.name}**\n` +
        `**ID:** \`${game.id}\`\n` +
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Vez:** ${game.players[game.currentTurn].name}`
    )
    .setColor(0x5865f2)
    .setFooter({ text: "As cartas continuam privadas." })
    .setTimestamp();
}

function buildGameRow(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truco_viewhand_${matchId}`)
      .setLabel("Ver minha mão")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`truco_truco_${matchId}`)
      .setLabel("Truco")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`truco_run_${matchId}`)
      .setLabel("Correr")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = async (interaction, client) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.log(`Comando não encontrado: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Erro ao executar o comando ${interaction.commandName}:`, error);

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: "❌ Deu erro ao executar o comando.",
          });
        } else {
          await interaction.reply({
            content: "❌ Deu erro ao executar o comando.",
            flags: 64,
          });
        }
      } catch (replyError) {
        console.error("Erro ao responder a interação após falha:", replyError);
      }
    }

    return;
  }

  // Botões
  if (interaction.isButton()) {
    try {
      const customId = interaction.customId;

      if (!customId.startsWith("truco_")) return;

      const parts = customId.split("_");
      const action = parts[1];
      const matchId = parts.slice(2).join("_");

      const game = getGame(matchId);

      if (!game) {
        return interaction.reply({
          content: "❌ Essa partida não existe mais.",
          flags: 64,
        });
      }

      const playerKey = findPlayerKey(game, interaction.user.id);

      if (!playerKey) {
        return interaction.reply({
          content: "❌ Você não faz parte desta partida.",
          flags: 64,
        });
      }

      if (action === "accept") {
        if (interaction.user.id !== game.opponentId) {
          return interaction.reply({
            content: "❌ Só o oponente pode aceitar esta partida.",
            flags: 64,
          });
        }

        if (game.status !== "waiting_accept") {
          return interaction.reply({
            content: "❌ Essa partida já foi aceita.",
            flags: 64,
          });
        }

        game.status = "playing";

        await interaction.update({
          embeds: [buildPublicGameEmbed(game)],
          components: [buildGameRow(matchId)],
          content: `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`,
        });

        return interaction.followUp({
          content:
            `🃏 **Sua mão**\n\n` +
            `Partida: \`${matchId}\`\n` +
            `Adversário: **${game.players.p1.name}**\n\n` +
            `${formatHand(game.players.p2.hand)}`,
          flags: 64,
        });
      }

      if (action === "viewhand") {
        const opponentKey = playerKey === "p1" ? "p2" : "p1";

        return interaction.reply({
          content:
            `🃏 **Sua mão**\n\n` +
            `Partida: \`${matchId}\`\n` +
            `Adversário: **${game.players[opponentKey].name}**\n\n` +
            `${formatHand(game.players[playerKey].hand)}`,
          flags: 64,
        });
      }

      if (action === "truco") {
        if (game.status !== "playing") {
          return interaction.reply({
            content: "❌ A partida ainda não começou.",
            flags: 64,
          });
        }

        return interaction.reply({
          content: `🗣️ ${interaction.user.username} pediu TRUCO!`,
          flags: 64,
        });
      }

      if (action === "run") {
        if (game.status !== "playing") {
          return interaction.reply({
            content: "❌ A partida ainda não começou.",
            flags: 64,
          });
        }

        return interaction.reply({
          content: `🏳️ ${interaction.user.username} correu da mão.`,
          flags: 64,
        });
      }
    } catch (error) {
      console.error("Erro ao processar botão do truco:", error);

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "❌ Deu erro ao processar essa ação.",
            flags: 64,
          });
        } else {
          await interaction.reply({
            content: "❌ Deu erro ao processar essa ação.",
            flags: 64,
          });
        }
      } catch (replyError) {
        console.error("Erro ao responder botão após falha:", replyError);
      }
    }
  }
};