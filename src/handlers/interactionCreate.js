const {
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
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

async function updatePlayerHandMessage(client, game, playerKey) {
  const channelId = game.privateChannels?.[playerKey]?.channelId;
  const messageId = game.privateChannels?.[playerKey]?.messageId;

  if (!channelId || !messageId) return;

  const channel = await client.channels.fetch(channelId);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId);
  if (!message) return;

  const payload = await createPrivateHandPayload(game, playerKey);
  await message.edit(payload);
}

async function updateBothHandMessages(client, game) {
  await updatePlayerHandMessage(client, game, "p1");
  await updatePlayerHandMessage(client, game, "p2");
}

async function createPrivateHandChannel(guild, parentId, name, userId, botUserId) {
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parentId || null,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: userId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: botUserId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages,
        ],
      },
    ],
  });
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

      if (interaction.commandName === "truco" && interaction.options.getSubcommand() === "criar") {
        const lastReply = await interaction.fetchReply().catch(() => null);
        if (!lastReply) return;

        const matchIdMatch = lastReply.embeds?.[0]?.data?.description?.match(/truco_\d+_\d+/);
        if (!matchIdMatch) return;
      }
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

      const guild = interaction.guild;
      const parentId = process.env.TRUCO_HANDS_CATEGORY_ID || interaction.channel.parentId || null;

      const p1Channel = await createPrivateHandChannel(
        guild,
        parentId,
        `mao-${game.id}-p1`,
        game.players.p1.id,
        client.user.id
      );

      const p2Channel = await createPrivateHandChannel(
        guild,
        parentId,
        `mao-${game.id}-p2`,
        game.players.p2.id,
        client.user.id
      );

      game.privateChannels = {
        p1: {
          channelId: p1Channel.id,
          messageId: null,
        },
        p2: {
          channelId: p2Channel.id,
          messageId: null,
        },
      };

      game.status = "playing";
      game.actionText = `${interaction.user.username} aceitou a partida. ${game.players[game.currentTurn].name} começa.`;

      await interaction.update(await createPublicMessagePayload(game));

      const p1Message = await p1Channel.send(await createPrivateHandPayload(game, "p1"));
      const p2Message = await p2Channel.send(await createPrivateHandPayload(game, "p2"));

      game.privateChannels.p1.messageId = p1Message.id;
      game.privateChannels.p2.messageId = p2Message.id;

      await p1Channel.send(`🃏 Sua mão está aqui, <@${game.players.p1.id}>.`);
      await p2Channel.send(`🃏 Sua mão está aqui, <@${game.players.p2.id}>.`);

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

      await updatePublicGameMessage(client, game);
      await updateBothHandMessages(client, game);

      return interaction.deferUpdate();
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

      await updatePublicGameMessage(client, game);
      await updateBothHandMessages(client, game);

      return interaction.deferUpdate();
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

      await updatePublicGameMessage(client, game);
      await updateBothHandMessages(client, game);

      return interaction.deferUpdate();
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
        game.actionText = `${interaction.user.username} jogou ${playedCard.label}.`;

        await updatePublicGameMessage(client, game);
        await updateBothHandMessages(client, game);

        return interaction.deferUpdate();
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
      await updateBothHandMessages(client, game);

      return interaction.deferUpdate();
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