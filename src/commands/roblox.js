const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function calcularIdadeConta(createdAt) {
  const now = new Date();

  let years = now.getFullYear() - createdAt.getFullYear();
  let months = now.getMonth() - createdAt.getMonth();
  let days = now.getDate() - createdAt.getDate();

  if (days < 0) {
    months--;
    const ultimoDiaDoMesAnterior = new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    ).getDate();
    days += ultimoDiaDoMesAnterior;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return `${years}a ${months}m ${days}d`;
}

function traduzirStatus(userPresence) {
  switch (userPresence) {
    case 1:
      return "🟢 Online";
    case 2:
      return "🎮 Jogando";
    case 3:
      return "🛠️ No Studio";
    default:
      return "⚫ Offline";
  }
}

function formatarNumero(valor) {
  return new Intl.NumberFormat("pt-BR").format(valor || 0);
}

async function podeVerInventario(userId) {
  const response = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/can-view-inventory`
  );

  if (!response.ok) {
    throw new Error(`Falha ao verificar inventário: ${response.status}`);
  }

  const data = await response.json();
  return Boolean(data.canView);
}

async function buscarItensPorAssetType(userId, assetType) {
  let cursor = null;
  let total = 0;
  const assetIds = [];
  let paginas = 0;
  const MAX_PAGINAS = 4;

  while (paginas < MAX_PAGINAS) {
    const url = new URL(`https://inventory.roblox.com/v2/users/${userId}/inventory`);
    url.searchParams.set("assetTypes", assetType);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortOrder", "Asc");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Falha ao buscar inventário (${assetType}): ${response.status}`);
    }

    const data = await response.json();
    const itens = Array.isArray(data.data) ? data.data : [];

    total += itens.length;

    for (const item of itens) {
      if (item?.assetId) {
        assetIds.push(item.assetId);
      }
    }

    paginas++;

    if (!data.nextPageCursor) break;
    cursor = data.nextPageCursor;
  }

  return { total, assetIds };
}

async function buscarInventarioPublico(userId) {
  const visivel = await podeVerInventario(userId);

  if (!visivel) {
    return {
      publico: false,
      totalItens: 0,
      assetIds: [],
      erro: "Inventário privado",
    };
  }

  const tipos = [
    "Hat",
    "Face",
    "BackAccessory",
    "FrontAccessory",
    "ShoulderAccessory",
    "WaistAccessory",
    "HairAccessory",
    "NeckAccessory",
    "Shirt",
    "Pants",
    "TShirt",
    "Gear",
    "EmoteAnimation",
  ];

  let totalItens = 0;
  const assetIdsSet = new Set();

  for (const tipo of tipos) {
    try {
      const parte = await buscarItensPorAssetType(userId, tipo);
      totalItens += parte.total;

      for (const id of parte.assetIds) {
        assetIdsSet.add(id);
      }
    } catch (error) {
      console.error(`Erro ao buscar tipo ${tipo}:`, error.message);
    }
  }

  return {
    publico: true,
    totalItens,
    assetIds: [...assetIdsSet],
    erro: null,
  };
}

async function buscarDetalhesDoAsset(assetId) {
  try {
    const response = await fetch(
      `https://economy.roblox.com/v2/assets/${assetId}/details`
    );

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

function classificarEExtrairPreco(details) {
  if (!details) {
    return { categoria: "sem-dados", preco: 0 };
  }

  const collectibleLowest =
    details.collectibleLowestResalePrice ??
    details.CollectibleLowestResalePrice ??
    details.lowestResalePrice ??
    details.lowestPrice ??
    0;

  const isCollectible =
    Boolean(details.collectibleItemId) ||
    Boolean(details.CollectibleItemId) ||
    (typeof collectibleLowest === "number" && collectibleLowest > 0);

  if (isCollectible && collectibleLowest > 0) {
    return {
      categoria: "limited",
      preco: collectibleLowest,
    };
  }

  const isForSale = details.isForSale ?? details.IsForSale ?? false;
  const precoNormal =
    details.priceInRobux ??
    details.PriceInRobux ??
    details.price ??
    0;

  if (isForSale && typeof precoNormal === "number") {
    if (precoNormal === 0) {
      return { categoria: "free", preco: 0 };
    }

    if (precoNormal > 0) {
      return {
        categoria: "normal",
        preco: precoNormal,
      };
    }
  }

  return { categoria: "ignorado", preco: 0 };
}

async function somarValoresSeparados(assetIds) {
  const ids = assetIds.slice(0, 150);

  let valorNormal = 0;
  let valorLimited = 0;

  let normaisSomados = 0;
  let limitedsSomados = 0;
  let freeIgnorados = 0;
  let offsaleIgnorados = 0;

  for (const assetId of ids) {
    const details = await buscarDetalhesDoAsset(assetId);
    if (!details) continue;

    const classificacao = classificarEExtrairPreco(details);

    if (classificacao.categoria === "normal") {
      valorNormal += classificacao.preco;
      normaisSomados++;
      continue;
    }

    if (classificacao.categoria === "limited") {
      valorLimited += classificacao.preco;
      limitedsSomados++;
      continue;
    }

    if (classificacao.categoria === "free") {
      freeIgnorados++;
      continue;
    }

    const isForSale = details.isForSale ?? details.IsForSale ?? false;
    if (!isForSale) {
      offsaleIgnorados++;
    }
  }

  return {
    valorNormal,
    valorLimited,
    valorTotal: valorNormal + valorLimited,
    itensAnalisados: ids.length,
    normaisSomados,
    limitedsSomados,
    freeIgnorados,
    offsaleIgnorados,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Busca informações de um usuário do Roblox")
    .addStringOption((option) =>
      option
        .setName("usuario")
        .setDescription("Nome do jogador do Roblox")
        .setRequired(true)
    ),

  async execute(interaction) {
    const usuario = interaction.options.getString("usuario");

    await interaction.deferReply();

    try {
      const userResponse = await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usernames: [usuario],
            excludeBannedUsers: false,
          }),
        }
      );

      const userData = await userResponse.json();

      if (!userData.data || !userData.data.length) {
        return await interaction.editReply(
          "Não consegui buscar esse usuário do Roblox."
        );
      }

      const basicUser = userData.data[0];
      const userId = basicUser.id;

      const profileResponse = await fetch(
        `https://users.roblox.com/v1/users/${userId}`
      );
      const profileData = await profileResponse.json();

      const friendsResponse = await fetch(
        `https://friends.roblox.com/v1/users/${userId}/friends/count`
      );
      const friendsData = await friendsResponse.json();

      const avatarResponse = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
      );
      const avatarData = await avatarResponse.json();

      let statusTexto = "⚫ Offline";

      try {
        const presenceResponse = await fetch(
          "https://presence.roblox.com/v1/presence/users",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userIds: [userId],
            }),
          }
        );

        const presenceData = await presenceResponse.json();
        const userPresence =
          presenceData?.userPresences?.[0]?.userPresenceType ?? 0;

        statusTexto = traduzirStatus(userPresence);
      } catch {
        statusTexto = "⚫ Offline";
      }

      let inventarioInfo = {
        publico: false,
        totalItens: 0,
        assetIds: [],
        erro: "Não foi possível verificar",
      };

      try {
        inventarioInfo = await buscarInventarioPublico(userId);
      } catch (error) {
        console.error("Erro ao buscar inventário:", error.message);
        inventarioInfo = {
          publico: false,
          totalItens: 0,
          assetIds: [],
          erro: "Falha ao consultar inventário",
        };
      }

      let valores = {
        valorNormal: 0,
        valorLimited: 0,
        valorTotal: 0,
        itensAnalisados: 0,
        normaisSomados: 0,
        limitedsSomados: 0,
        freeIgnorados: 0,
        offsaleIgnorados: 0,
      };

      if (inventarioInfo.publico && inventarioInfo.assetIds.length) {
        valores = await somarValoresSeparados(inventarioInfo.assetIds);
      }

      const createdAt = new Date(profileData.created);
      const idadeConta = calcularIdadeConta(createdAt);
      const avatarUrl = avatarData?.data?.[0]?.imageUrl || null;

      const bio = profileData.description?.trim()
        ? profileData.description.slice(0, 1000)
        : "Sem bio";

      const inventarioStatus = inventarioInfo.publico
        ? "🟢 Público"
        : `🔒 ${inventarioInfo.erro}`;

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${profileData.displayName}`)
        .setURL(`https://www.roblox.com/users/${userId}/profile`)
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Nome",
            value: profileData.name || "Desconhecido",
            inline: true,
          },
          {
            name: "Display Name",
            value: profileData.displayName || "Desconhecido",
            inline: true,
          },
          {
            name: "ID",
            value: String(profileData.id),
            inline: true,
          },
          {
            name: "Amigos",
            value: String(friendsData.count ?? 0),
            inline: true,
          },
          {
            name: "Status",
            value: statusTexto,
            inline: true,
          },
          {
            name: "Conta criada",
            value: createdAt.toLocaleDateString("pt-BR"),
            inline: true,
          },
          {
            name: "Idade da conta",
            value: idadeConta,
            inline: true,
          },
          {
            name: "Inventário",
            value: inventarioStatus,
            inline: true,
          },
          {
            name: "Itens encontrados",
            value: inventarioInfo.publico ? String(inventarioInfo.totalItens) : "—",
            inline: true,
          },
          {
            name: "Valor normal",
            value: inventarioInfo.publico
              ? `${formatarNumero(valores.valorNormal)} Robux`
              : "—",
            inline: true,
          },
          {
            name: "Valor limited",
            value: inventarioInfo.publico
              ? `${formatarNumero(valores.valorLimited)} Robux`
              : "—",
            inline: true,
          },
          {
            name: "Total estimado",
            value: inventarioInfo.publico
              ? `${formatarNumero(valores.valorTotal)} Robux`
              : "—",
            inline: true,
          },
          {
            name: "Cobertura da soma",
            value: inventarioInfo.publico
              ? `${valores.normaisSomados + valores.limitedsSomados}/${valores.itensAnalisados} itens somados`
              : "—",
            inline: false,
          },
          {
            name: "Resumo da soma",
            value: inventarioInfo.publico
              ? [
                  `🛒 Normais somados: ${valores.normaisSomados}`,
                  `💎 Limiteds somados: ${valores.limitedsSomados}`,
                  `🆓 Free ignorados: ${valores.freeIgnorados}`,
                  `🚫 Offsale ignorados: ${valores.offsaleIgnorados}`,
                ].join("\n")
              : "—",
            inline: false,
          },
          {
            name: "Bio",
            value: bio,
          }
        )
        .setImage(avatarUrl)
        .setFooter({
          text: "Estimativa: preço atual dos itens à venda + lowest resale dos collectibles",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao buscar perfil Roblox:", error);
      await interaction.editReply("Erro ao consultar a API do Roblox.");
    }
  },
};