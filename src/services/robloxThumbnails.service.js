const axios = require("axios");
const routes = require("../constants/apiRoutes");

async function getAvatarHeadshot(userId) {
  const { data } = await axios.get(routes.AVATAR_HEADSHOT(userId));
  return data.data?.[0]?.imageUrl || null;
}

async function getAvatarFull(userId) {
  const { data } = await axios.get(routes.AVATAR_FULL(userId));
  return data.data?.[0]?.imageUrl || null;
}

module.exports = {
  getAvatarHeadshot,
  getAvatarFull
};