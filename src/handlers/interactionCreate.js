const {
  activeGames,
  getGame,
  findPlayerKey,
  deleteGame,
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
const { recordMatchResult } = require("../games/trucoStats");

function pushRoundHistory(game, winnerText) {
  const nextRoundNumber = game.roundHistory.length + 1;
  game.roundHistory.push(`${nextRoundNumber}ª rodada: ${winnerText}`);
}

function touchGame(game) {
  game.lastActionAt = Date.now();
}

function resetTurnTimer(game) {
  if (game.status === "playing") {
    game.turnExpiresAt = Date.now() + (game.turnTimeoutMs || 120000);
  } else {
    game.turnExpiresAt = null;
  }
}

async function resendPublicGameMessage(client, game) {
  const channel = await client.channels.fetch(game.channelId).catch(() => null);
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
      // ignora
    }
  }
}

async function finalizeByInactivity(client, game) {
  game.status = "finished";
  game.currentTurn = null;
  game.actionText = "Partida encerrada por inatividade.";

  await resendPublicGameMessage(client, game);
  deleteGame(game.id);
}

async function finalizeByTurnTimeout(client, game) {
  const loserKey = game.currentTurn;
  const winnerKey = loserKey === "p1" ? "p2" : "p1";
  const points = game.roundValue;

  const result = awardHandPoints(game, winnerKey, points);
  touchGame(game);

  if (result.finished) {
    game.actionText = `${game.players[loserKey].name} demorou demais. ${makeMatchWinText(game.players[winnerKey].name)}`;

    if (!game.statsRecorded) {
      recordMatchResult(game.players[winnerKey].id, game.players[loserKey].id);
      game.statsRecorded = true;
    }
  } else {
    game.actionText = `${game.players[loserKey].name} demorou demais. ${game.players[winnerKey].name} levou ${points} ponto(s). Nova mão iniciada.`;
    resetTurnTimer(game);
  }

  await resendPublicGameMessage(client, game);

  if (game.status === "finished") {
    deleteGame(game.id);
  }
}

function startTrucoMaintenance(client) {
  if (client.__trucoMaintenanceStarted) return;
  client.__trucoMaintenanceStarted = true;

  setInterval(async () => {
    const now = Date.now();

    for (const game of activeGames.values()) {
      try {
        const idleLimit = game.idleTimeoutMs || 15 * 60 * 1000;

        if (now - game.lastActionAt > idleLimit) {
          await finalizeByInactivity(client, game);
          continue;
        }

        if (
          game.status === "playing" &&
          game.turnExpiresAt &&
          now > game.turnExpiresAt
        ) {
          await finalizeByTurnTimeout(client, game);
        }
      } catch (error) {
        console.error("Erro na manutenção do truco:", error);
      }
    }
  }, 15000);
}

async function safeErrorResponse(interaction, message) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: message,
        flags: 64,
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: message,
        flags: 64,
      }).catch(() => {});
    }
  } catch (error) {
    console.error("Erro ao responder falha da interação:", error);
  }
}

module.exports = async (interaction, client) => {
  startTrucoMaintenance(client);

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
      await safeErrorResponse(interaction, "❌ Deu erro ao executar o comando.");
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
      await safeErrorResponse(interaction, "❌ Essa partida não existe mais.");
      return;
    }

    const playerKey = findPlayerKey(game, interaction.user.id);

    if (!playerKey) {
      await safeErrorResponse(interaction, "❌ Você não faz parte desta partida.");
      return;
    }

    if (action === "accept") {
      if (interaction.user.id !== game.opponentId) {
        await safeErrorResponse(interaction, "❌ Só o oponente pode aceitar esta partida.");
        return;
      }

      if (game.status !== "waiting_accept") {
        await safeErrorResponse(interaction, "❌ Essa partida já foi aceita.");
        return;
      }

      await interaction.deferUpdate();

      game.status = "playing";
      game.actionText = `${interaction.user.username} aceitou a partida. ${game.players[game.currentTurn].name} começa.`;
      touchGame(game);
      resetTurnTimer(game);

      await resendPublicGameMessage(client, game);
      return;
    }

    if (action === "openhand") {
      if (game.status !== "playing") {
        await safeErrorResponse(interaction, "❌ Você só pode jogar depois que a partida for aceita.");
        return;
      }

      await interaction.reply({
        ...(await createPrivateHandPayload(game, playerKey)),
        flags: 64,
      });
      return;
    }

    if (action === "truco") {
      if (game.status !== "playing") {
        await safeErrorResponse(interaction, "❌ A partida ainda não começou.");
        return;
      }

      if (game.pendingTruco) {
        await safeErrorResponse(interaction, "❌ Já existe um pedido de truco pendente.");
        return;
      }

      if (game.roundValue >= 3) {
        await safeErrorResponse(interaction, "❌ Essa mão já está valendo 3 pontos.");
        return;
      }

      await interaction.deferUpdate();

      game.pendingTruco = {
        requestedBy: playerKey,
      };
      game.actionText = makeTrucoText(interaction.user.username);
      touchGame(game);

      await resendPublicGameMessage(client, game);
      return;
    }

    if (action === "accepttruco") {
      if (!game.pendingTruco) {
        await safeErrorResponse(interaction, "❌ Não existe truco pendente.");
        return;
      }

      if (game.pendingTruco.requestedBy === playerKey) {
        await safeErrorResponse(interaction, "❌ Você não pode aceitar o próprio truco.");
        return;
      }

      await interaction.deferUpdate();

      game.roundValue = 3;
      game.pendingTruco = null;
      game.actionText = `${interaction.user.username} aceitou o TRUCO. A mão agora vale 3 pontos.`;
      touchGame(game);
      resetTurnTimer(game);

      await resendPublicGameMessage(client, game);
      return;
    }

    if (action === "run") {
      if (game.status !== "playing") {
        await safeErrorResponse(interaction, "❌ A partida ainda não começou.");
        return;
      }

      await interaction.deferUpdate();

      const winnerKey = getOpponentKey(playerKey);
      const loserKey = playerKey;
      const points = game.roundValue;
      const result = awardHandPoints(game, winnerKey, points);

      game.pendingTruco = null;
      touchGame(game);

      if (result.finished) {
        game.actionText = makeMatchWinText(game.players[winnerKey].name);

        if (!game.statsRecorded) {
          recordMatchResult(game.players[winnerKey].id, game.players[loserKey].id);
          game.statsRecorded = true;
        }
      } else {
        game.actionText = makeRunText(
          interaction.user.username,
          game.players[winnerKey].name,
          points
        );
        resetTurnTimer(game);
      }

      await resendPublicGameMessage(client, game);

      if (game.status === "finished") {
        deleteGame(game.id);
      }
      return;
    }

    if (action === "play") {
      if (game.status !== "playing") {
        await safeErrorResponse(interaction, "❌ A partida ainda não começou.");
        return;
      }

      if (game.pendingTruco) {
        await safeErrorResponse(interaction, "❌ Resolva o pedido de truco antes de jogar.");
        return;
      }

      if (game.currentTurn !== playerKey) {
        await safeErrorResponse(interaction, "❌ Não é sua vez.");
        return;
      }

      if (game.playedCards[playerKey]) {
        await safeErrorResponse(interaction, "❌ Você já jogou uma carta nesta rodada.");
        return;
      }

      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= game.players[playerKey].hand.length) {
        await safeErrorResponse(interaction, "❌ Carta inválida.");
        return;
      }

      if (!game.playedCards.p1 && !game.playedCards.p2) {
        game.displayedCards = { p1: null, p2: null };
      }

      const playedCard = game.players[playerKey].hand.splice(cardIndex, 1)[0];
      game.playedCards[playerKey] = playedCard;
      game.displayedCards[playerKey] = playedCard;
      touchGame(game);

      const opponentKey = getOpponentKey(playerKey);

      if (!game.playedCards[opponentKey]) {
        game.currentTurn = opponentKey;
        game.actionText = `${interaction.user.username} jogou ${getCardDisplayName(playedCard)}.`;
        resetTurnTimer(game);

        await interaction.update(createPostPlayEphemeralPayload(game, playerKey));
        await resendPublicGameMessage(client, game);
        return;
      }

      const { roundWinner, handWinner, cardP1, cardP2 } = resolveRound(game);

      const cardP1Name = getCardDisplayName(cardP1);
      const cardP2Name = getCardDisplayName(cardP2);

      if (roundWinner === "draw") {
        game.actionText = makeDrawText(cardP1Name, cardP2Name);
        pushRoundHistory(game, "Empate");
      } else {
        const winnerCard = roundWinner === "p1" ? cardP1Name : cardP2Name;
        const loserCard = roundWinner === "p1" ? cardP2Name : cardP1Name;
        game.actionText = makeRoundText(game.players[roundWinner].name, winnerCard, loserCard);
        pushRoundHistory(game, game.players[roundWinner].name);
      }

      if (handWinner) {
        const awardedPoints = game.roundValue;
        const loserKey = handWinner === "p1" ? "p2" : "p1";
        const result = awardHandPoints(game, handWinner, awardedPoints);

        if (result.finished) {
          game.actionText = makeMatchWinText(game.players[handWinner].name);

          if (!game.statsRecorded) {
            recordMatchResult(game.players[handWinner].id, game.players[loserKey].id);
            game.statsRecorded = true;
          }
        } else {
          game.actionText = `${makeHandText(game.players[handWinner].name, awardedPoints)} Nova mão iniciada.`;
          resetTurnTimer(game);
        }
      } else {
        resetTurnTimer(game);
      }

      await interaction.update(createPostPlayEphemeralPayload(game, playerKey));
      await resendPublicGameMessage(client, game);

      if (game.status === "finished") {
        deleteGame(game.id);
      }
      return;
    }
  } catch (error) {
    console.error("Erro ao processar botão do truco:", error);
    await safeErrorResponse(interaction, "❌ Deu erro ao processar essa ação.");
  }
};