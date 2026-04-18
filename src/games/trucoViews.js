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

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }

  return results;
}

function findCardFileByBaseName(baseName) {
  const allFiles = walkFiles(CARD_DIR);
  const normalizedBase = baseName.toLowerCase();

  for (const file of allFiles) {
    const parsed = path.parse(file);
    if (parsed.name.toLowerCase() === normalizedBase) {
      return file;
    }
  }

  return null;
}

function getNormalCardPath(card) {
  const suit = suitMap[card.suit];
  const rank = getRankFile(card.rank);

  if (!suit || !rank) return null;

  return findCardFileByBaseName(`card_${suit}_${rank}`);
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
      <circle cx="120" cy="170" r="52" fill="none" stroke="${color}" stroke-width="6"/>
      <text x="120" y="178" text-anchor="middle" font-size="32" fill="${color}" font-family="sans-serif" font-weight="bold">${label}</text>
      <text x="120" y="222" text-anchor="middle" font-size="18" fill="#ffffff" font-family="sans-serif">${subtitle}</text>
    </svg>
  `);
}

function createEmptyBoardSvg() {
  return Buffer.from(`
    <svg width="240" height="340" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="224" height="324" rx="18" fill="#111827" stroke="#334155" stroke-width="4"/>
      <text x="120" y="180" text-anchor="middle" font-size="56" fill="#475569" font-family="sans-serif" font-weight="bold">?</text>
    </svg>
  `);
}

async function loadCardBuffer(card) {
  if (!card) {
    return sharp(createEmptyBoardSvg()).png().toBuffer();
  }

  if (card.type === "manilha") {
    return sharp(createCardSvg(card.rank, getManilhaColor(card.rank), "MANILHA"))
      .png()
      .toBuffer();
  }

  const normalPath = getNormalCardPath(card);

  if (normalPath) {
    return sharp(normalPath)
      .resize(240, 340, {
        fit: "contain",
        background: "#0b1020",
      })
      .png()
      .toBuffer();
  }

  return sharp(createCardSvg(card.label, "#22d3ee", "ARQUIVO NÃO ENCONTRADO"))
    .png()
    .toBuffer();
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

function buildPendingTrucoRow(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truco_accepttruco_${matchId}`)
      .setLabel("Aceitar Truco")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`truco_run_${matchId}`)
      .setLabel("Correr")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildGameRow(matchId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`truco_openhand_${matchId}`)
      .setLabel("Ver minha mão")
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
        `**Valor da mão:** ${game.roundValue}\n` +
        `**Vez:** ${game.players[game.currentTurn]?.name || "-"}\n\n` +
        `**Status:** ${game.actionText}`
    )
    .setColor(game.status === "finished" ? 0x22c55e : 0x5865f2)
    .setImage("attachment://truco-board.png")
    .setFooter({ text: "As mãos ficam privadas. A mesa é pública." })
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
  } else if (game.status === "playing" && game.pendingTruco) {
    components = [buildPendingTrucoRow(game.id)];
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
    game.status !== "playing" ||
    !!game.pendingTruco;

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