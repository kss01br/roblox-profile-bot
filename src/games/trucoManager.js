const activeGames = new Map();

function createMatchId() {
  return `truco_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function setGame(game) {
  activeGames.set(game.id, game);
}

function getGame(matchId) {
  return activeGames.get(matchId);
}

function deleteGame(matchId) {
  activeGames.delete(matchId);
}

function findPlayerKey(game, userId) {
  if (game.players.p1.id === userId) return "p1";
  if (game.players.p2.id === userId) return "p2";
  return null;
}

function isUserInAnyGame(userId) {
  for (const game of activeGames.values()) {
    if (
      game.status !== "finished" &&
      (game.players.p1.id === userId || game.players.p2.id === userId)
    ) {
      return true;
    }
  }
  return false;
}

module.exports = {
  activeGames,
  createMatchId,
  setGame,
  getGame,
  deleteGame,
  findPlayerKey,
  isUserInAnyGame,
};