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

  if (card.type === "manilha") {
    return manilhaStrength[card.rank] || 0;
  }

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
  game.playedCards = {
    p1: null,
    p2: null,
  };
  game.displayedCards = {
    p1: null,
    p2: null,
  };
  game.roundValue = 1;
  game.status = "playing";
  game.pendingTruco = null;
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

function makeRoundText(winnerName, winnerCard, loserCard) {
  return pickRandom([
    `${winnerName} venceu a rodada com ${winnerCard} contra ${loserCard}.`,
    `A carta maior falou mais alto: ${winnerCard} de ${winnerName}.`,
    `${winnerName} levou a rodada com ${winnerCard}.`,
    `${winnerName} não deixou barato: ${winnerCard} venceu ${loserCard}.`,
  ]);
}

function makeDrawText(cardA, cardB) {
  return pickRandom([
    `Rodada empatada: ${cardA} contra ${cardB}.`,
    `Ninguém levou essa. ${cardA} e ${cardB} ficaram iguais.`,
    `Empate na rodada entre ${cardA} e ${cardB}.`,
  ]);
}

function makeHandText(winnerName, points) {
  return pickRandom([
    `${winnerName} venceu a mão e ganhou ${points} ponto(s).`,
    `${winnerName} fechou a mão e somou ${points} ponto(s).`,
    `${winnerName} tomou a frente e levou ${points} ponto(s).`,
  ]);
}

function makeTrucoText(playerName) {
  return pickRandom([
    `${playerName} pediu TRUCO! Vai aceitar?`,
    `${playerName} gritou TRUCO! O clima esquentou.`,
    `${playerName} chamou no peito: TRUCO.`,
  ]);
}

function makeRunText(playerName, winnerName, points) {
  return pickRandom([
    `${playerName} correu. ${winnerName} levou ${points} ponto(s).`,
    `${playerName} arregou na mão. ${winnerName} soma ${points} ponto(s).`,
    `${playerName} saiu da disputa. ${winnerName} ganha ${points} ponto(s).`,
  ]);
}

function makeMatchWinText(winnerName) {
  return pickRandom([
    `${winnerName} venceu a partida!`,
    `${winnerName} fechou o jogo e saiu com a vitória!`,
    `${winnerName} dominou a mesa e ganhou a partida!`,
  ]);
}

module.exports = {
  getOpponentKey,
  compareCards,
  resolveRound,
  startNewHand,
  awardHandPoints,
  makeRoundText,
  makeDrawText,
  makeHandText,
  makeTrucoText,
  makeRunText,
  makeMatchWinText,
};