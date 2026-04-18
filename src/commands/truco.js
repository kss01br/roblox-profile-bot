const { SlashCommandBuilder } = require("discord.js");
const {
  createDeck,
  shuffleDeck,
  dealHands,
} = require("../games/trucoDeck");

// memória simples
const activeGames = new Map();

function createMatchId() {
  return `truco_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function formatHand(hand) {
  return hand.map((card, index) => `${index + 1}. ${card.label}`).join("\n");
}

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
    const memberRoles = interaction.member.roles.cache;

    if (!allowedRoleId) {
      return interaction.reply({
        content: "❌ TRUCO_ALLOWED_ROLE_ID não configurado no .env.",
        ephemeral: true,
      });
    }

    if (!memberRoles.has(allowedRoleId)) {
      return interaction.reply({
        content: "❌ Você não tem permissão para usar o truco.",
        ephemeral: true,
      });
    }

    if (subcommand === "criar") {
      const opponent = interaction.options.getUser("oponente");

      if (opponent.id === interaction.user.id) {
        return interaction.reply({
          content: "❌ Você não pode jogar contra você mesmo.",
          ephemeral: true,
        });
      }

      if (opponent.bot) {
        return interaction.reply({
          content: "❌ Você não pode jogar contra um bot.",
          ephemeral: true,
        });
      }

      const matchId = createMatchId();

      const deck = createDeck();
      const shuffledDeck = shuffleDeck(deck);
      const { p1Hand, p2Hand, remainingDeck } = dealHands(shuffledDeck);

      const game = {
        id: matchId,
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
        roundStarter: "p1",
        currentTurn: "p1",
        roundResults: [],
        playedCards: {
          p1: null,
          p2: null,
        },
        deck: remainingDeck,
        status: "playing",
      };

      activeGames.set(matchId, game);

      await interaction.reply({
        content:
          `🃏 Partida criada!\n\n` +
          `${interaction.user} vs ${opponent}\n` +
          `ID: \`${matchId}\`\n\n` +
          `**Mão de ${interaction.user.username}:**\n${formatHand(p1Hand)}\n\n` +
          `**Mão de ${opponent.username}:**\n${formatHand(p2Hand)}`,
      });

      console.log("Nova partida criada:", game);
    }
  },
};