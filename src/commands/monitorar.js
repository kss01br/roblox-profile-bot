const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { getUserByUsername } = require("../utils/robloxUser");
const { addMonitor } = require("../utils/monitorStore");

async function fetchPresence(userIds) {
  const res = await fetch("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userIds }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status} ao buscar presence\n${text}`);
  }

  return res.json();
}

async function getGameInfo(placeId) {
  if (!placeId) return null;

  try {
    const universeRes = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );

    if (!universeRes.ok) return null;

    const universeData = await universeRes.json();
    const universeId = universeData?.universeId;

    if (!universeId) return null;

    const gameRes = await fetch(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );

    if (!gameRes.ok) return null;

    const gameData = await gameRes.json();
    const game = gameData?.data?.[0];

    return {
      name: game?.name || null,
      universeId,
      playing: game?.playing ?? null,
    };
  } catch {
    return null;
  }
}

async function getGameIcon(universeId) {
  if (!universeId) return null;

  try {
    const url = new URL("https://thumbnails.roblox.com/v1/games/icons");
    url.searchParams.set("universeIds", String(universeId));
    url.searchParams.set("returnPolicy", "PlaceHolder");
    url.searchParams.set("size", "512x512");
    url.searchParams.set("format", "Png");
    url.searchParams.set("isCircular", "false");

    const res = await fetch(url.toString());

    if (!res.ok) return null;

    const data = await res.json();
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

function getStatusText(type) {
  if (type === 0) return "⚫ Offline";
  if (type === 1) return "🟢 Online";
  if (type === 2) return "🎮 Jogando";
  if (type === 3) return "🛠️ No Studio";
  return "❔ Desconhecido";
}

function formatLastOnline(lastOnline) {
  if (!lastOnline) return "Indisponível";

  const then = new Date(lastOnline).getTime();
  const now = Date.now();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia(s)`;
}

function buildGameButton(placeId) {
  if (!placeId) return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Entrar no jogo")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.roblox.com/games/${placeId}`)
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monitorar")
    .setDescription("Monitora a presença de um jogador Roblox")
    .addStringOption((option) =>
      option
        .setName("nick")
        .setDescription("Nome do jogador")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const allowedRoleId = process.env.MONITOR_ALLOWED_ROLE_ID;
      const memberRoles = interaction.member?.roles?.cache;

      if (!allowedRoleId) {
        return interaction.editReply("❌ MONITOR_ALLOWED_ROLE_ID não configurado.");
      }

      if (!memberRoles || !memberRoles.has(allowedRoleId)) {
        return interaction.editReply("❌ Você não tem o cargo permitido para usar este comando.");
      }

      const nick = interaction.options.getString("nick", true);
      const user = await getUserByUsername(nick);

      const presenceData = await fetchPresence([user.userId]);
      const presence = presenceData?.userPresences?.[0];

      let gameName = null;
      let universeId = null;
      let thumbnailUrl = null;
      let playingCount = null;

      if (presence?.placeId) {
        const gameInfo = await getGameInfo(presence.placeId);
        gameName = gameInfo?.name || "Carregando jogo...";
        universeId = gameInfo?.universeId || null;
        playingCount = gameInfo?.playing ?? null;
        thumbnailUrl = await getGameIcon(universeId);
      }

      const list = addMonitor(interaction.user.id, {
        robloxUserId: String(user.userId),
        username: user.username,
        displayName: user.displayName,
        lastPresenceType: presence?.userPresenceType ?? null,
        lastPlaceId: presence?.placeId ?? null,
        lastOnline: presence?.lastOnline ?? null,
        lastGameName: gameName,
        lastUniverseId: universeId,
        lastThumbnailUrl: thumbnailUrl,
        startedPlayingAt: presence?.userPresenceType === 2 ? Date.now() : null,
      });

      const monitored = list.map((p, i) => `${i + 1}. ${p.username}`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("👁️ Monitoramento iniciado")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Jogador",
            value: `**${user.displayName || user.username}** (@${user.username})`,
            inline: false,
          },
          {
            name: "Status atual",
            value: getStatusText(presence?.userPresenceType ?? -1),
            inline: true,
          },
          {
            name: "Último online",
            value: formatLastOnline(presence?.lastOnline),
            inline: true,
          },
          {
            name: "Jogo atual",
            value: gameName || "Não está em jogo",
            inline: false,
          },
          {
            name: "Seus monitoramentos",
            value: monitored || "Nenhum",
            inline: false,
          }
        )
        .setFooter({
          text: "Limite: 2 jogadores. Se adicionar outro, o mais antigo sai.",
        })
        .setTimestamp();

      if (playingCount !== null) {
        embed.addFields({
          name: "👥 Jogando agora",
          value: String(playingCount),
          inline: true,
        });
      }

      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }

      await interaction.editReply({
        embeds: [embed],
        components: buildGameButton(presence?.placeId),
      });
    } catch (error) {
      console.error("Erro no comando /monitorar:", error);
      await interaction.editReply("❌ Erro ao iniciar monitoramento.");
    }
  },
};