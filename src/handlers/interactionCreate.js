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
const {
  getOpponentKey,
  resolveRound,
  awardHandPoints,
  makePlayText,
  makeRoundText,
  makeDrawText,
  makeHandText,
  makeTrucoText,
  makeRunText,
  makeMatchWinText,
} = require("../games/trucoLogic");

function formatRoundResults(roundResults) {
  if (!roundResults || roundResults.length === 0) return "Nenhuma rodada concluída.";

  return roundResults
    .map((result, index) => {
      if (result === "p1") return `${index + 1}ª: ${"P1"}`;
      if (result === "p2") return `${index + 1}ª: ${"P2"}`;
      return `${index + 1}ª: Empate`;
    })
    .join(" • ");
}

function buildPublicGameEmbed(game) {
  const p1Played = game.playedCards.p1 ? game.playedCards.p1.label : "—";
  const p2Played = game.playedCards.p2 ? game.playedCards.p2.label : "—";

  return new EmbedBuilder()
    .setTitle("🃏 Truco Lunar")
    .setDescription(
      `**Status:** ${game.status === "playing" ? "Em andamento" : game.status === "finished" ? "Finalizada" : "Aguardando aceite"}\n\n` +
        `**${game.players.p1.name}** ${game.score.p1} x ${game.score.p2} **${game.players.p2.name}**\n` +
        `**ID:** \`${game.id}\`\n` +
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Vez:** ${game.players[game.currentTurn]?.name || "-"}\n\n` +
        `**Cartas restantes**\n` +
        `${game.players.p1.name}: ${game.players.p1.hand.length}\n` +
        `${game.players.p2.name}: ${game.players.p2.hand.length}\n\n` +
        `**Cartas jogadas na rodada**\n` +
        `${game.players.p1.name}: ${p1Played}\n` +
        `${game.players.p2.name}: ${p2Played}\n\n` +
        `**Rodadas:** ${formatRoundResults(game.roundResults)}\n\n` +
        `**Última ação:** ${game.lastAction}`
    )
    .setColor(game.status === "finished" ? 0x22c55e : 0x5865f2)
    .setFooter({ text: "As mãos continuam privadas." })
    .setTimestamp();
}

function buildAcceptRow(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truco_accept_${matchId}`)
      .setLabel("Aceitar partida")
      .setStyle(ButtonStyle.Success)
  );
}

function buildGameRow(matchId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truco_openhand_${matchId}`)
      .setLabel("Começar partida")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`truco_truco_${matchId}`)
      .setLabel("Truco")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`truco_run_${matchId}`)
      .setLabel("Correr")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

function buildPrivateHandEmbed(game, playerKey) {
  const opponentKey = getOpponentKey(playerKey);
  const isTurn = game.currentTurn === playerKey;
  const alreadyPlayed = !!game.playedCards[playerKey];

  let statusText = "Aguardando.";
  if (game.status !== "playing") {
    statusText = "A partida ainda não está em andamento.";
  } else if (alreadyPlayed) {
    statusText = "Você já jogou nesta rodada.";
  } else if (isTurn) {
    statusText = "É sua vez de jogar.";
  } else {
    statusText = `Aguardando ${game.players[game.currentTurn].name}.`;
  }

  return new EmbedBuilder()
    .setTitle("🃏 Sua mão")
    .setDescription(
      `**Partida:** \`${game.id}\`\n` +
        `**Adversário:** ${game.players[opponentKey].name}\n` +
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Status:** ${statusText}\n\n` +
        `${formatHand(game.players[playerKey].hand)}`
    )
    .setColor(0x8b5cf6)
    .setTimestamp();
}

function buildHandButtons(matchId, hand, disabled = false) {
  const row = new ActionRowBuilder();

  hand.forEach((card, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`truco_play_${matchId}_${index}`)
        .setLabel(card.label.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  });

  return row;
}

async function updatePublicGameMessage(client, game) {
  try {
    const channel = await client.channels.fetch(game.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(game.messageId);
    if (!message) return;

    let components = [];

    if (game.status === "waiting_accept") {
      components = [buildAcceptRow(game.id)];
    } else if (game.status === "playing") {
      components = [buildGameRow(game.id)];
    } else if (game.status === "finished") {
      components = [buildGameRow(game.id, true)];
    }

    await message.edit({
      embeds: [buildPublicGameEmbed(game)],
      components,
      content:
        game.status === "finished"
          ? `🏆 Partida finalizada! <@${game.players.p1.id}> vs <@${game.players.p2.id}>`
          : game.status === "playing"
          ? `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`
          : `🎮 <@${game.opponentId}>, você foi desafiado para uma partida de truco.`,
    });
  } catch (error) {
    console.error("Erro ao atualizar mensagem pública do truco:", error);
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

  if (interaction.isButton()) {
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
        game.lastAction = `${interaction.user.username} aceitou a partida. ${game.players[game.currentTurn].name} começa.`;

        await interaction.update({
          embeds: [buildPublicGameEmbed(game)],
          components: [buildGameRow(matchId)],
          content: `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`,
        });

        return;
      }

      if (action === "openhand") {
        if (game.status !== "playing") {
          return interaction.reply({
            content: "❌ Você só pode abrir sua mão depois que a partida for aceita.",
            flags: 64,
          });
        }

        const disabled =
          game.currentTurn !== playerKey ||
          !!game.playedCards[playerKey] ||
          game.players[playerKey].hand.length === 0;

        return interaction.reply({
          embeds: [buildPrivateHandEmbed(game, playerKey)],
          components:
            game.players[playerKey].hand.length > 0
              ? [buildHandButtons(matchId, game.players[playerKey].hand, disabled)]
              : [],
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
        game.lastAction = makeTrucoText(interaction.user.username);

        await interaction.update({
          embeds: [buildPublicGameEmbed(game)],
          components: [buildGameRow(matchId)],
          content: `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`,
        });

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
        const result = awardHandPoints(game, winnerKey, game.roundValue);

        if (result.finished) {
          game.lastAction = makeMatchWinText(game.players[winnerKey].name);
        } else {
          game.lastAction = makeRunText(
            interaction.user.username,
            game.players[winnerKey].name,
            game.roundValue
          );
        }

        await interaction.update({
          embeds: [buildPublicGameEmbed(game)],
          components: [buildGameRow(matchId, game.status === "finished")],
          content:
            game.status === "finished"
              ? `🏆 Partida finalizada! <@${game.players.p1.id}> vs <@${game.players.p2.id}>`
              : `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`,
        });

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

        const opponentKey = getOpponentKey(playerKey);
        game.lastAction = makePlayText(interaction.user.username, playedCard.label);

        if (!game.playedCards[opponentKey]) {
          game.currentTurn = opponentKey;

          await updatePublicGameMessage(client, game);

          const disabled =
            game.currentTurn !== playerKey ||
            !!game.playedCards[playerKey] ||
            game.players[playerKey].hand.length === 0;

          return interaction.update({
            embeds: [buildPrivateHandEmbed(game, playerKey)],
            components:
              game.players[playerKey].hand.length > 0
                ? [buildHandButtons(matchId, game.players[playerKey].hand, disabled)]
                : [],
          });
        }

        const p1Card = game.playedCards.p1;
        const p2Card = game.playedCards.p2;

        const { roundWinner, handWinner } = resolveRound(game);

        if (roundWinner === "draw") {
          game.lastAction = makeDrawText(p1Card.label, p2Card.label);
        } else {
          const winnerCard = roundWinner === "p1" ? p1Card.label : p2Card.label;
          const loserCard = roundWinner === "p1" ? p2Card.label : p1Card.label;
          game.lastAction = makeRoundText(game.players[roundWinner].name, winnerCard, loserCard);
        }

        if (handWinner) {
          const awardedPoints = game.roundValue;
          const result = awardHandPoints(game, handWinner, awardedPoints);

          if (result.finished) {
            game.lastAction = makeMatchWinText(game.players[handWinner].name);
          } else {
            game.lastAction = `${makeHandText(game.players[handWinner].name, awardedPoints)} Nova mão iniciada.`;
          }
        }

        await updatePublicGameMessage(client, game);

        const disabled =
          game.currentTurn !== playerKey ||
          !!game.playedCards[playerKey] ||
          game.players[playerKey].hand.length === 0;

        return interaction.update({
          embeds: [buildPrivateHandEmbed(game, playerKey)],
          components:
            game.players[playerKey].hand.length > 0
              ? [buildHandButtons(matchId, game.players[playerKey].hand, disabled)]
              : [],
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