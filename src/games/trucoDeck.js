const suits = ["ouro", "espada", "copas", "paus"];
const ranks = ["Q", "J", "K", "A", "2", "3"];

function createDeck() {
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        type: "normal",
        rank,
        suit,
        label: `${rank}_${suit}`,
      });
    }
  }

  deck.push({ type: "manilha", rank: "M1", label: "M1" });
  deck.push({ type: "manilha", rank: "M2", label: "M2" });
  deck.push({ type: "manilha", rank: "M3", label: "M3" });
  deck.push({ type: "manilha", rank: "M4", label: "M4" });

  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function dealHands(deck) {
  const workingDeck = [...deck];

  const p1Hand = [workingDeck.pop(), workingDeck.pop(), workingDeck.pop()];
  const p2Hand = [workingDeck.pop(), workingDeck.pop(), workingDeck.pop()];

  return {
    p1Hand,
    p2Hand,
    remainingDeck: workingDeck,
  };
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealHands,
};