const { SlashCommandBuilder } = require("discord.js");
const {
  createDeck,
  shuffleDeck,
  dealHands,
} = require("../games/trucoDeck");
const {
  createMatchId,
  setGame,
  isUserInAnyGame,
} = require("../games/trucoManager");
const { createPublicMessagePayload } = require("../games/trucoViews");

const TURN_TIMEOUT_MS = 2 * 60 * 1000;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("truco")
    .setDescription("Comandos do truco")
    .addSubcommand((sub) =>
      sub
        .setName("criar")
        .setDescription("Cria uma partida de truco")
        .addUserOption((option) =>
          option
            .setName("oponente")
            .setDescription("Escolha seu adversário")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const allowedRoleId = process.env.TRUCO_ALLOWED_ROLE_ID;
    const memberRoles = interaction.member?.roles?.cache;

    if (!allowedRoleId) {
      return interaction.reply({
        content: "❌ TRUCO_ALLOWED_ROLE_ID não configurado no .env.",
        flags: 64,
      });
    }

    if (!memberRoles || !memberRoles.has(allowedRoleId)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar o truco.",
        flags: 64,
      });
    }

    if (subcommand !== "criar") return;

    const opponent = interaction.options.getUser("oponente");

    if (!opponent) {
      return interaction.reply({
        content: "❌ Oponente inválido.",
        flags: 64,
      });
    }

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Você não pode jogar contra você mesmo.",
        flags: 64,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: "❌ Você não pode jogar contra um bot.",
        flags: 64,
      });
    }

    if (isUserInAnyGame(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Você já está em uma partida ativa.",
        flags: 64,
      });
    }

    if (isUserInAnyGame(opponent.id)) {
      return interaction.reply({
        content: "❌ O oponente já está em uma partida ativa.",
        flags: 64,
      });
    }

    const deck = shuffleDeck(createDeck());
    const { p1Hand, p2Hand, remainingDeck } = dealHands(deck);
    const matchId = createMatchId();

    const now = Date.now();

    const game = {
      id: matchId,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      creatorId: interaction.user.id,
      opponentId: opponent.id,
      messageId: null,
      status: "waiting_accept",
      players: {
        p1: {
          id: interaction.user.id,
          name: interaction.user.username,
          hand: p1Hand,
        },
        p2: {
          id: opponent.id,
          name: opponent.username,
          hand: p2Hand,
        },
      },
      score: {
        p1: 0,
        p2: 0,
      },
      roundValue: 1,
      handStarter: "p1",
      roundStarter: "p1",
      currentTurn: "p1",
      roundResults: [],
      roundHistory: [],
      playedCards: {
        p1: null,
        p2: null,
      },
      displayedCards: {
        p1: null,
        p2: null,
      },
      deck: remainingDeck,
      createdAt: now,
      lastActionAt: now,
      turnExpiresAt: now + TURN_TIMEOUT_MS,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      turnTimeoutMs: TURN_TIMEOUT_MS,
      actionText: "Aguardando o aceite do oponente.",
      pendingTruco: null,
      statsRecorded: false,
    };

    setGame(game);

    const payload = await createPublicMessagePayload(game);
    await interaction.reply(payload);

    const reply = await interaction.fetchReply();
    game.messageId = reply.id;
  },
};