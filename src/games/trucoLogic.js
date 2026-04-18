const { createDeck, shuffleDeck, dealHands } = require("./trucoDeck");

const normalStrength = {
  Q: 1,
  J: 2,
  K: 3,
  A: 4,
  "2": 5,
  "3": 6,
};

const manilhaStrength = {
  M1: 7,
  M2: 8,
  M3: 9,
  M4: 10,
};

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getOpponentKey(playerKey) {
  return playerKey === "p1" ? "p2" : "p1";
}

function getCardStrength(card) {
  if (!card) return 0;
  if (card.type === "manilha") return manilhaStrength[card.rank] || 0;
  return normalStrength[card.rank] || 0;
}

function compareCards(cardP1, cardP2) {
  const s1 = getCardStrength(cardP1);
  const s2 = getCardStrength(cardP2);

  if (s1 > s2) return "p1";
  if (s2 > s1) return "p2";
  return "draw";
}

function checkHandWinner(roundResults, handStarter) {
  const p1Wins = roundResults.filter((r) => r === "p1").length;
  const p2Wins = roundResults.filter((r) => r === "p2").length;

  if (p1Wins >= 2) return "p1";
  if (p2Wins >= 2) return "p2";

  if (roundResults.length >= 2) {
    if (roundResults[0] === "draw" && roundResults[1] !== "draw") {
      return roundResults[1];
    }

    if (roundResults[0] !== "draw" && roundResults[1] === "draw") {
      return roundResults[0];
    }
  }

  if (roundResults.length === 3) {
    if (roundResults[2] !== "draw") return roundResults[2];
    const firstNonDraw = roundResults.find((r) => r !== "draw");
    return firstNonDraw || handStarter;
  }

  return null;
}

function resolveRound(game) {
  const cardP1 = game.playedCards.p1;
  const cardP2 = game.playedCards.p2;

  const result = compareCards(cardP1, cardP2);
  game.roundResults.push(result);

  const handWinner = checkHandWinner(game.roundResults, game.handStarter);

  game.playedCards.p1 = null;
  game.playedCards.p2 = null;

  if (!handWinner) {
    if (result === "draw") {
      game.currentTurn = game.roundStarter;
    } else {
      game.roundStarter = result;
      game.currentTurn = result;
    }
  }

  return {
    roundWinner: result,
    handWinner,
    cardP1,
    cardP2,
  };
}

function startNewHand(game, starterKey) {
  const deck = shuffleDeck(createDeck());
  const { p1Hand, p2Hand, remainingDeck } = dealHands(deck);

  game.players.p1.hand = p1Hand;
  game.players.p2.hand = p2Hand;
  game.deck = remainingDeck;

  game.handStarter = starterKey;
  game.roundStarter = starterKey;
  game.currentTurn = starterKey;
  game.roundResults = [];
  game.playedCards = { p1: null, p2: null };
  game.displayedCards = { p1: null, p2: null };
  game.roundValue = 1;
  game.pendingTruco = null;
  game.status = "playing";
}

function awardHandPoints(game, winnerKey, points) {
  game.score[winnerKey] += points;

  if (game.score[winnerKey] >= 8) {
    game.status = "finished";
    game.currentTurn = winnerKey;
    return {
      finished: true,
      matchWinner: winnerKey,
    };
  }

  startNewHand(game, winnerKey);

  return {
    finished: false,
    matchWinner: null,
  };
}

function getCardDisplayName(card) {
  if (!card) return "Carta desconhecida";

  if (card.type === "manilha") {
    const map = {
      M1: "Manilha 1",
      M2: "Manilha 2",
      M3: "Manilha 3",
      M4: "Manilha 4",
    };
    return map[card.rank] || card.rank;
  }

  const rankMap = {
    A: "Ás",
    K: "Rei",
    Q: "Dama",
    J: "Valete",
    "2": "2",
    "3": "3",
  };

  const suitMap = {
    espada: "espada",
    copas: "copas",
    ouro: "ouro",
    paus: "paus",
  };

  return `${rankMap[card.rank] || card.rank} de ${suitMap[card.suit] || card.suit}`;
}

function makeRoundText(winnerName, winnerCard, loserCard) {
  return pickRandom([
    `${winnerName} venceu a rodada com ${winnerCard} contra ${loserCard}.`,
    `A carta maior falou mais alto: ${winnerCard} de ${winnerName}.`,
    `${winnerName} levou a rodada com ${winnerCard}.`,
    `${winnerName} não deixou barato: ${winnerCard} venceu ${loserCard}.`,
    `${winnerName} mostrou força com ${winnerCard}.`,
    `${winnerName} passou por cima com ${winnerCard}.`,
    `${winnerName} encaixou ${winnerCard} e levou a rodada.`,
    `${winnerName} dominou a rodada com ${winnerCard}.`,
    `${winnerName} respondeu melhor e venceu com ${winnerCard}.`,
    `${winnerName} encaixou a carta maior: ${winnerCard}.`,
  ]);
}

function makeDrawText(cardA, cardB) {
  return pickRandom([
    `Rodada empatada: ${cardA} contra ${cardB}.`,
    `Ninguém levou essa. ${cardA} e ${cardB} ficaram iguais.`,
    `Empate na rodada entre ${cardA} e ${cardB}.`,
    `${cardA} e ${cardB} bateram de frente.`,
    `Tudo igual na mesa: ${cardA} contra ${cardB}.`,
    `A rodada travou: ${cardA} e ${cardB}.`,
    `Nenhum dos dois levou. ${cardA} igualou ${cardB}.`,
    `Empate seco entre ${cardA} e ${cardB}.`,
    `A mesa ficou neutra: ${cardA} e ${cardB}.`,
    `Rodada sem vencedor: ${cardA} bateu em ${cardB}.`,
  ]);
}

function makeHandText(winnerName, points) {
  return pickRandom([
    `${winnerName} venceu a mão e ganhou ${points} ponto(s).`,
    `${winnerName} fechou a mão e somou ${points} ponto(s).`,
    `${winnerName} tomou a frente e levou ${points} ponto(s).`,
    `${winnerName} garantiu a mão e marcou ${points} ponto(s).`,
    `${winnerName} saiu melhor e faturou ${points} ponto(s).`,
    `${winnerName} foi mais frio e levou ${points} ponto(s).`,
    `${winnerName} encaixou a mão e somou ${points} ponto(s).`,
    `${winnerName} controlou a mão e ganhou ${points} ponto(s).`,
    `${winnerName} ficou com a mão e levou ${points} ponto(s).`,
    `${winnerName} confirmou a vantagem e marcou ${points} ponto(s).`,
  ]);
}

function makeTrucoText(playerName) {
  return pickRandom([
    `${playerName} pediu TRUCO! Vai aceitar?`,
    `${playerName} gritou TRUCO! O clima esquentou.`,
    `${playerName} chamou no peito: TRUCO.`,
    `${playerName} dobrou a pressão e pediu TRUCO.`,
    `${playerName} subiu a aposta: TRUCO.`,
    `${playerName} quis acelerar a mão com um TRUCO.`,
    `${playerName} apertou o jogo: TRUCO.`,
    `${playerName} trouxe fogo pra mesa: TRUCO.`,
    `${playerName} chamou a responsa: TRUCO.`,
    `${playerName} jogou pesado e pediu TRUCO.`,
  ]);
}

function makeRunText(playerName, winnerName, points) {
  return pickRandom([
    `${playerName} correu. ${winnerName} levou ${points} ponto(s).`,
    `${playerName} arregou na mão. ${winnerName} soma ${points} ponto(s).`,
    `${playerName} saiu da disputa. ${winnerName} ganha ${points} ponto(s).`,
    `${playerName} preferiu não pagar pra ver. ${winnerName} marca ${points} ponto(s).`,
    `${playerName} recuou. ${winnerName} ficou com ${points} ponto(s).`,
    `${playerName} abandonou a mão. ${winnerName} leva ${points} ponto(s).`,
    `${playerName} deixou passar. ${winnerName} pontua ${points}.`,
    `${playerName} não quis seguir. ${winnerName} soma ${points}.`,
    `${playerName} baixou a guarda. ${winnerName} ganha ${points}.`,
    `${playerName} correu da pressão. ${winnerName} leva ${points}.`,
  ]);
}

function makeMatchWinText(winnerName) {
  return pickRandom([
    `${winnerName} venceu a partida!`,
    `${winnerName} fechou o jogo e saiu com a vitória!`,
    `${winnerName} dominou a mesa e ganhou a partida!`,
    `${winnerName} foi mais frio e levou essa!`,
    `${winnerName} confirmou o favoritismo e venceu!`,
    `${winnerName} saiu por cima no fim do duelo!`,
    `${winnerName} encaixou o jogo e venceu a partida!`,
    `${winnerName} levou a melhor e fechou o placar!`,
    `${winnerName} segurou a pressão e ganhou!`,
    `${winnerName} foi o dono da mesa no final!`,
  ]);
}

module.exports = {
  getOpponentKey,
  compareCards,
  resolveRound,
  startNewHand,
  awardHandPoints,
  getCardDisplayName,
  makeRoundText,
  makeDrawText,
  makeHandText,
  makeTrucoText,
  makeRunText,
  makeMatchWinText,
};