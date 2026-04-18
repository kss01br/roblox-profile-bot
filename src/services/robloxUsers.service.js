const axios = require("axios");
const routes = require("../constants/apiRoutes");

async function getUserByUsername(username) {
  const { data } = await axios.post(routes.USERS_BY_USERNAME, {
    usernames: [username],
    excludeBannedUsers: false
  });

  if (!data.data || !data.data.length) {
    throw new Error("Usuário não encontrado.");
  }

  return data.data[0];
}

async function getUserById(userId) {
  const { data } = await axios.get(routes.USER_BY_ID(userId));
  return data;
}

module.exports = {
  getUserByUsername,
  getUserById
};