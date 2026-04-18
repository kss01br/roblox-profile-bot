const {
  getGame,
  findPlayerKey,
} = require("../games/trucoManager");
const {
  getOpponentKey,
  resolveRound,
  awardHandPoints,
  makeRoundText,
  makeDrawText,
  makeHandText,
  makeTrucoText,
  makeRunText,
  makeMatchWinText,
} = require("../games/trucoLogic");
const {
  createPublicMessagePayload,
  createPrivateHandPayload,
} = require("../games/trucoViews");

async function updatePublicGameMessage(client, game) {
  const channel = await client.channels.fetch(game.channelId);
  if (!channel) return;

  const message = await channel.messages.fetch(game.messageId);
  if (!message) return;

  const payload = await createPublicMessagePayload(game);
  await message.edit(payload);
}

module.exports = async (interaction, client) => {
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

  if (!interaction.isButton()) return;

  try {
    const customId = interaction.customId;

    if (!customId.startsWith("truco_")) return;

    const parts = customId.split("_");
    const action = parts[1];

    let matchId = "";
    let cardIndex = null;

    if (action === "play") {
      cardIndex = Number(parts[parts.length - 1]);
      matchId = parts.slice(2, -1).join("_");
    } else {
      matchId = parts.slice(2).join("_");
    }

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
      game.actionText = `${interaction.user.username} aceitou a partida. ${game.players[game.currentTurn].name} começa.`;

      await interaction.update(await createPublicMessagePayload(game));
      return;
    }

    if (action === "openhand") {
      if (game.status !== "playing") {
        return interaction.reply({
          content: "❌ Você só pode abrir sua mão depois que a partida for aceita.",
          flags: 64,
        });
      }

      return interaction.reply({
        ...(await createPrivateHandPayload(game, playerKey)),
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

      if (game.roundValue >= 3) {
        return interaction.reply({
          content: "❌ Essa mão já está valendo 3 pontos.",
          flags: 64,
        });
      }

      game.roundValue = 3;
      game.actionText = makeTrucoText(interaction.user.username);

      await interaction.update(await createPublicMessagePayload(game));
      return;
    }

    if (action === "run") {
      if (game.status !== "playing") {
        return interaction.reply({
          content: "❌ A partida ainda não começou.",
          flags: 64,
        });
      }

      const winnerKey = getOpponentKey(playerKey);
      const points = game.roundValue;
      const result = awardHandPoints(game, winnerKey, points);

      if (result.finished) {
        game.actionText = makeMatchWinText(game.players[winnerKey].name);
      } else {
        game.actionText = makeRunText(
          interaction.user.username,
          game.players[winnerKey].name,
          points
        );
      }

      await interaction.update(await createPublicMessagePayload(game));
      return;
    }

    if (action === "play") {
      if (game.status !== "playing") {
        return interaction.reply({
          content: "❌ A partida ainda não começou.",
          flags: 64,
        });
      }

      if (game.currentTurn !== playerKey) {
        return interaction.reply({
          content: "❌ Não é sua vez.",
          flags: 64,
        });
      }

      if (game.playedCards[playerKey]) {
        return interaction.reply({
          content: "❌ Você já jogou uma carta nesta rodada.",
          flags: 64,
        });
      }

      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= game.players[playerKey].hand.length) {
        return interaction.reply({
          content: "❌ Carta inválida.",
          flags: 64,
        });
      }

      const playedCard = game.players[playerKey].hand.splice(cardIndex, 1)[0];
      game.playedCards[playerKey] = playedCard;
      game.displayedCards[playerKey] = playedCard;

      const opponentKey = getOpponentKey(playerKey);

      if (!game.playedCards[opponentKey]) {
        game.currentTurn = opponentKey;
        game.actionText = `${interaction.user.username} jogou ${playedCard.label}.`;

        await updatePublicGameMessage(client, game);

        return interaction.update(await createPrivateHandPayload(game, playerKey));
      }

      const { roundWinner, handWinner, cardP1, cardP2 } = resolveRound(game);

      if (roundWinner === "draw") {
        game.actionText = makeDrawText(cardP1.label, cardP2.label);
      } else {
        const winnerCard = roundWinner === "p1" ? cardP1.label : cardP2.label;
        const loserCard = roundWinner === "p1" ? cardP2.label : cardP1.label;
        game.actionText = makeRoundText(game.players[roundWinner].name, winnerCard, loserCard);
      }

      if (handWinner) {
        const awardedPoints = game.roundValue;
        const result = awardHandPoints(game, handWinner, awardedPoints);

        if (result.finished) {
          game.actionText = makeMatchWinText(game.players[handWinner].name);
        } else {
          game.actionText = `${makeHandText(game.players[handWinner].name, awardedPoints)} Nova mão iniciada.`;
        }
      }

      await updatePublicGameMessage(client, game);

      return interaction.update(await createPrivateHandPayload(game, playerKey));
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
};