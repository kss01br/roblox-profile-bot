async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erro ${response.status} em ${url}\n${text}`);
  }

  return response.json();
}

async function getUserByUsername(username) {
  const data = await fetchJson("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false,
    }),
  });

  const user = data?.data?.[0];
  if (!user) {
    throw new Error("Usuário não encontrado no Roblox.");
  }

  return {
    userId: user.id,
    username: user.name,
    displayName: user.displayName,
  };
}

async function getUserById(userId) {
  const data = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);

  return {
    userId: data.id,
    username: data.name,
    displayName: data.displayName,
  };
}

async function getAvatarImage(userId) {
  const url =
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`;

  const data = await fetchJson(url);
  const imageUrl = data?.data?.[0]?.imageUrl;

  if (!imageUrl) {
    throw new Error("Não foi possível obter a imagem do avatar.");
  }

  return imageUrl;
}

module.exports = {
  getUserByUsername,
  getUserById,
  getAvatarImage,
};