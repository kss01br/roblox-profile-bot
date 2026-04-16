const universeIds = maps.map((map) => String(map.placeId));
const gameStats = await getUniverseStats(universeIds);

const statsByUniverseId = new Map(
  gameStats.map((game) => [String(game.id), game])
);

const ranking = maps
  .map((map) => {
    const stats = statsByUniverseId.get(String(map.placeId));

    return {
      ...map,
      playing: stats?.playing ?? 0,
    };
  })
  .sort((a, b) => b.playing - a.playing);