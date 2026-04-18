const {
  getGame,
  findPlayerKey,
} = require("../games/trucoManager");
const {
  getOpponentKey,
  resolveRound,
  awardHandPoints,
  getCardDisplayName,
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
  createPostPlayEphemeralPayload,
} = require("../games/trucoViews");

console.log("trucoViews import:", {
  createPublicMessagePayload: typeof createPublicMessagePayload,
  createPrivateHandPayload: typeof createPrivateHandPayload,
  createPostPlayEphemeralPayload: typeof createPostPlayEphemeralPayload,
});

async function resendPublicGameMessage(client, game) {
  const channel = await client.channels.fetch(game.channelId);
  if (!channel) return;

  const oldMessageId = game.messageId;
  const payload = await createPublicMessagePayload(game);

  const newMessage = await channel.send(payload);
  game.messageId = newMessage.id;

  if (oldMessageId) {
    try {
      const oldMessage = await channel.messages.fetch(oldMessageId);
      if (oldMessage) {
        await oldMessage.delete().catch(() => {});
      }
    } catch {
      // ignora se não achar a antiga
    }
  }
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

      await interaction.deferUpdate();
      await resendPublicGameMessage(client, game);
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

      if (game.pendingTruco) {
        return interaction.reply({
          content: "❌ Já existe um pedido de truco pendente.",
          flags: 64,
        });
      }

      if (game.roundValue >= 3) {
        return interaction.reply({
          content: "❌ Essa mão já está valendo 3 pontos.",
          flags: 64,
        });
      }

      game.pendingTruco = {
        requestedBy: playerKey,
      };
      game.actionText = makeTrucoText(interaction.user.username);

      await interaction.deferUpdate();
      await resendPublicGameMessage(client, game);
      return;
    }

    if (action === "accepttruco") {
      if (!game.pendingTruco) {
        return interaction.reply({
          content: "❌ Não existe truco pendente.",
          flags: 64,
        });
      }

      if (game.pendingTruco.requestedBy === playerKey) {
        return interaction.reply({
          content: "❌ Você não pode aceitar o próprio truco.",
          flags: 64,
        });
      }

      game.roundValue = 3;
      game.pendingTruco = null;
      game.actionText = `${interaction.user.username} aceitou o TRUCO. A mão agora vale 3 pontos.`;

      await interaction.deferUpdate();
      await resendPublicGameMessage(client, game);
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

      game.pendingTruco = null;

      if (result.finished) {
        game.actionText = makeMatchWinText(game.players[winnerKey].name);
      } else {
        game.actionText = makeRunText(
          interaction.user.username,
          game.players[winnerKey].name,
          points
        );
      }

      await interaction.deferUpdate();
      await resendPublicGameMessage(client, game);
      return;
    }

    if (action === "play") {
      if (game.status !== "playing") {
        return interaction.reply({
          content: "❌ A partida ainda não começou.",
          flags: 64,
        });
      }

      if (game.pendingTruco) {
        return interaction.reply({
          content: "❌ Resolva o pedido de truco antes de jogar.",
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

      if (!game.playedCards.p1 && !game.playedCards.p2) {
        game.displayedCards = { p1: null, p2: null };
      }

      const playedCard = game.players[playerKey].hand.splice(cardIndex, 1)[0];
      game.playedCards[playerKey] = playedCard;
      game.displayedCards[playerKey] = playedCard;

      const opponentKey = getOpponentKey(playerKey);

      if (!game.playedCards[opponentKey]) {
        game.currentTurn = opponentKey;
        game.actionText = `${interaction.user.username} jogou ${getCardDisplayName(playedCard)}.`;

        await resendPublicGameMessage(client, game);

        return interaction.update(
          createPostPlayEphemeralPayload(game, playerKey)
        );
      }

      const { roundWinner, handWinner, cardP1, cardP2 } = resolveRound(game);

      const cardP1Name = getCardDisplayName(cardP1);
      const cardP2Name = getCardDisplayName(cardP2);

      if (roundWinner === "draw") {
        game.actionText = makeDrawText(cardP1Name, cardP2Name);
      } else {
        const winnerCard = roundWinner === "p1" ? cardP1Name : cardP2Name;
        const loserCard = roundWinner === "p1" ? cardP2Name : cardP1Name;
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

      await resendPublicGameMessage(client, game);

      return interaction.update(
        createPostPlayEphemeralPayload(game, playerKey)
      );
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