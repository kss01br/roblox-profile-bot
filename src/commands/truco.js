const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  createDeck,
  shuffleDeck,
  dealHands,
} = require("../games/trucoDeck");
const {
  createMatchId,
  setGame,
  formatHand,
} = require("../games/trucoManager");

function buildPublicGameEmbed(game, creatorId, opponentId) {
  return new EmbedBuilder()
    .setTitle("🃏 Truco Lunar")
    .setDescription(
      `**Partida criada**\n\n` +
        `<@${creatorId}> vs <@${opponentId}>\n` +
        `ID: \`${game.id}\`\n\n` +
        `**Status:** ${game.status === "waiting_accept" ? "Aguardando aceite" : "Em andamento"}\n` +
        `**Placar:** ${game.players.p1.name} 0 x 0 ${game.players.p2.name}\n` +
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Vez:** ${game.players[game.currentTurn].name}\n\n` +
        `**Última ação:** ${game.lastAction}`
    )
    .setColor(0x5865f2)
    .setFooter({ text: "As cartas ficam ocultas. Só as ações aparecem para todos." })
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

    const deck = shuffleDeck(createDeck());
    const { p1Hand, p2Hand, remainingDeck } = dealHands(deck);
    const matchId = createMatchId();

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
      playedCards: {
        p1: null,
        p2: null,
      },
      deck: remainingDeck,
      createdAt: Date.now(),
      lastAction: "Aguardando o aceite do oponente.",
    };

    setGame(game);

    const embed = buildPublicGameEmbed(game, interaction.user.id, opponent.id);
    const row = buildAcceptRow(matchId);

    const reply = await interaction.reply({
      content: `🎮 <@${opponent.id}>, você foi desafiado para uma partida de truco.`,
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    game.messageId = reply.id;

    await interaction.followUp({
      content:
        `🃏 **Sua mão**\n\n` +
        `Partida: \`${matchId}\`\n` +
        `Oponente: **${opponent.username}**\n\n` +
        `${formatHand(p1Hand)}`,
      flags: 64,
    });
  },
};