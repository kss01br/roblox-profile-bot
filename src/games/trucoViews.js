const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const CARD_DIR = path.join(__dirname, "..", "assets", "cards");

const suitMap = {
  espada: "spades",
  copas: "hearts",
  ouro: "diamonds",
  paus: "clubs",
};

function getRankFile(rank) {
  if (rank === "2") return "02";
  if (rank === "3") return "03";
  return rank;
}

function getNormalCardPath(card) {
  const suit = suitMap[card.suit];
  const rank = getRankFile(card.rank);

  const candidates = [
    path.join(CARD_DIR, `card_${suit}_${rank}.png`),
    path.join(CARD_DIR, `card_${suit}_${rank}.jpg`),
    path.join(CARD_DIR, `card_${suit}_${rank}.jpeg`),
    path.join(CARD_DIR, `${`card_${suit}_${rank}`}`),
  ];

  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getManilhaColor(rank) {
  if (rank === "M1") return "#94a3b8";
  if (rank === "M2") return "#f97316";
  if (rank === "M3") return "#eab308";
  return "#8b5cf6";
}

function createCardSvg(label, color, subtitle = "") {
  return Buffer.from(`
    <svg width="240" height="340" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="224" height="324" rx="18" fill="#0b1020" stroke="${color}" stroke-width="6"/>
      <text x="28" y="52" font-size="36" fill="${color}" font-family="Arial" font-weight="bold">${label}</text>
      <text x="120" y="180" text-anchor="middle" font-size="54" fill="${color}" font-family="Arial" font-weight="bold">${label}</text>
      <text x="120" y="220" text-anchor="middle" font-size="20" fill="#ffffff" font-family="Arial">${subtitle}</text>
    </svg>
  `);
}

function createBackSvg() {
  return Buffer.from(`
    <svg width="240" height="340" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="224" height="324" rx="18" fill="#111827" stroke="#475569" stroke-width="6"/>
      <rect x="28" y="28" width="184" height="284" rx="14" fill="#0f172a" stroke="#64748b" stroke-width="2"/>
      <text x="120" y="180" text-anchor="middle" font-size="72" fill="#94a3b8" font-family="Arial" font-weight="bold">?</text>
    </svg>
  `);
}

async function loadCardBuffer(card) {
  if (!card) {
    return sharp(createBackSvg()).png().toBuffer();
  }

  if (card.type === "manilha") {
    return sharp(createCardSvg(card.rank, getManilhaColor(card.rank), "MANILHA"))
      .png()
      .toBuffer();
  }

  const normalPath = getNormalCardPath(card);

  if (normalPath) {
    return sharp(normalPath).resize(240, 340, { fit: "contain", background: "#0b1020" }).png().toBuffer();
  }

  return sharp(createCardSvg(card.label, "#22d3ee", "CARTA")).png().toBuffer();
}

async function composeCards(buffers, options = {}) {
  const cardWidth = options.cardWidth || 240;
  const cardHeight = options.cardHeight || 340;
  const gap = options.gap || 20;
  const padding = options.padding || 20;
  const bg = options.bg || "#0b1020";

  const width = padding * 2 + cardWidth * buffers.length + gap * Math.max(0, buffers.length - 1);
  const height = padding * 2 + cardHeight;

  const composites = await Promise.all(
    buffers.map(async (buffer, index) => ({
      input: await sharp(buffer).resize(cardWidth, cardHeight).png().toBuffer(),
      left: padding + index * (cardWidth + gap),
      top: padding,
    }))
  );

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bg,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function renderBoardImage(game) {
  const p1Card = game.displayedCards?.p1 || null;
  const p2Card = game.displayedCards?.p2 || null;

  const buffers = [
    await loadCardBuffer(p1Card),
    await loadCardBuffer(p2Card),
  ];

  return composeCards(buffers, {
    cardWidth: 220,
    cardHeight: 320,
    gap: 36,
    padding: 20,
    bg: "#0b1020",
  });
}

async function renderHandImage(hand) {
  if (!hand || hand.length === 0) {
    return sharp(createCardSvg("SEM", "#64748b", "CARTAS")).png().toBuffer();
  }

  const buffers = [];
  for (const card of hand) {
    buffers.push(await loadCardBuffer(card));
  }

  return composeCards(buffers, {
    cardWidth: 180,
    cardHeight: 260,
    gap: 16,
    padding: 16,
    bg: "#0b1020",
  });
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

function buildHandButtons(matchId, hand, disabled = false) {
  const row = new ActionRowBuilder();

  hand.forEach((card, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`truco_play_${matchId}_${index}`)
        .setLabel(`Carta ${index + 1}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  });

  return row;
}

function buildPublicGameEmbed(game) {
  return new EmbedBuilder()
    .setTitle("🃏 Truco Lunar")
    .setDescription(
      `**${game.players.p1.name}** ${game.score.p1} x ${game.score.p2} **${game.players.p2.name}**\n` +
        `**ID:** \`${game.id}\`\n` +
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Vez:** ${game.players[game.currentTurn]?.name || "-"}\n\n` +
        `**Ação atual:** ${game.lastAction}`
    )
    .setColor(game.status === "finished" ? 0x22c55e : 0x5865f2)
    .setImage("attachment://truco-board.png")
    .setFooter({ text: "As cartas da mão ficam privadas." })
    .setTimestamp();
}

function buildPrivateHandEmbed(game, playerKey) {
  const opponentKey = playerKey === "p1" ? "p2" : "p1";
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
        `**Status:** ${statusText}`
    )
    .setColor(0x8b5cf6)
    .setImage("attachment://truco-hand.png")
    .setTimestamp();
}

async function createPublicMessagePayload(game) {
  const boardBuffer = await renderBoardImage(game);
  const boardFile = new AttachmentBuilder(boardBuffer, { name: "truco-board.png" });

  let components = [];
  if (game.status === "waiting_accept") {
    components = [buildAcceptRow(game.id)];
  } else if (game.status === "playing") {
    components = [buildGameRow(game.id)];
  } else {
    components = [buildGameRow(game.id, true)];
  }

  return {
    content:
      game.status === "finished"
        ? `🏆 Partida finalizada! <@${game.players.p1.id}> vs <@${game.players.p2.id}>`
        : game.status === "playing"
        ? `✅ Partida aceita! <@${game.creatorId}> vs <@${game.opponentId}>`
        : `🎮 <@${game.opponentId}>, você foi desafiado para uma partida de truco.`,
    embeds: [buildPublicGameEmbed(game)],
    components,
    files: [boardFile],
  };
}

async function createPrivateHandPayload(game, playerKey) {
  const handBuffer = await renderHandImage(game.players[playerKey].hand);
  const handFile = new AttachmentBuilder(handBuffer, { name: "truco-hand.png" });

  const disabled =
    game.currentTurn !== playerKey ||
    !!game.playedCards[playerKey] ||
    game.players[playerKey].hand.length === 0 ||
    game.status !== "playing";

  return {
    embeds: [buildPrivateHandEmbed(game, playerKey)],
    components:
      game.players[playerKey].hand.length > 0
        ? [buildHandButtons(game.id, game.players[playerKey].hand, disabled)]
        : [],
    files: [handFile],
  };
}

module.exports = {
  createPublicMessagePayload,
  createPrivateHandPayload,
};