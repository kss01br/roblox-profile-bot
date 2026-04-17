const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
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

async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  const url = new URL("https://games.roblox.com/v1/games/multiget-place-details");
  url.searchParams.set("placeIds", String(placeId));

  const res = await fetch(url.toString());

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erro ${res.status} ao buscar detalhes do place\n${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
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
      const nick = interaction.options.getString("nick", true);
      const user = await getUserByUsername(nick);

      const presenceData = await fetchPresence([user.userId]);
      const presence = presenceData?.userPresences?.[0];

      let gameName = null;
      let gameLink = null;

      if (presence?.placeId) {
        const placeDetails = await getPlaceDetails(presence.placeId);
        gameName = placeDetails?.name || null;
        gameLink = `https://www.roblox.com/games/${presence.placeId}`;
      }

      const list = addMonitor(interaction.user.id, {
        robloxUserId: String(user.userId),
        username: user.username,
        lastPresenceType: presence?.userPresenceType ?? null,
        lastPlaceId: presence?.placeId ?? null,
        lastOnline: presence?.lastOnline ?? null,
        lastGameName: gameName,
      });

      const statusText = getStatusText(presence?.userPresenceType ?? -1);
      const monitored = list.map((p, i) => `${i + 1}. ${p.username}`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("👁️ Monitoramento iniciado")
        .setColor(0x5865f2)
        .setDescription(
          [
            `**Jogador:** ${user.displayName || user.username} (@${user.username})`,
            `**Status atual:** ${statusText}`,
            `**Último online:** ${formatLastOnline(presence?.lastOnline)}`,
            gameName ? `**Jogo atual:** ${gameName}` : null,
            gameLink ? `**Link:** ${gameLink}` : null,
            "",
            `**Seus monitoramentos:**`,
            monitored,
            "",
            "⚠️ Limite: 2 jogadores. Se adicionar outro, o mais antigo sai.",
          ]
            .filter(Boolean)
            .join("\n")
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no comando /monitorar:", error);
      await interaction.editReply("❌ Erro ao iniciar monitoramento.");
    }
  },
};