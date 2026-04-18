module.exports = {
  USERS_BY_USERNAME: "https://users.roblox.com/v1/usernames/users",
  USER_BY_ID: (id) => `https://users.roblox.com/v1/users/${id}`,
  FRIENDS_COUNT: (id) => `https://friends.roblox.com/v1/users/${id}/friends/count`,
  PRESENCE: "https://presence.roblox.com/v1/presence/users",
  AVATAR_HEADSHOT: (id) =>
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`,
  AVATAR_FULL: (id) =>
    `https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=720x720&format=Png&isCircular=false`
};