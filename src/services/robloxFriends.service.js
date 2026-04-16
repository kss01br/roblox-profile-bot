const axios = require("axios");
const routes = require("../constants/apiRoutes");

async function getFriendsCount(userId) {
  const { data } = await axios.get(routes.FRIENDS_COUNT(userId));
  return data.count ?? 0;
}

module.exports = {
  getFriendsCount
};