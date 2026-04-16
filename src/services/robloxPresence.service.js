const axios = require("axios");
const routes = require("../constants/apiRoutes");

function translatePresenceType(type) {
  switch (type) {
    case 0:
      return "Offline";
    case 1:
      return "Online";
    case 2:
      return "In Game";
    case 3:
      return "In Studio";
    default:
      return "Desconhecido";
  }
}

async function getUserPresence(userId) {
  const { data } = await axios.post(routes.PRESENCE, {
    userIds: [Number(userId)]
  });

  const presence = data.userPresences?.[0];

  if (!presence) {
    return {
      status: "Desconhecido",
      lastOnline: null
    };
  }

  return {
    status: translatePresenceType(presence.userPresenceType),
    lastOnline: presence.lastOnline || null
  };
}

module.exports = {
  getUserPresence
};