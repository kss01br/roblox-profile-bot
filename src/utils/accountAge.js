function getAccountAge(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();

  let years = now.getFullYear() - created.getFullYear();
  let months = now.getMonth() - created.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years > 0) {
    return `${years} ano(s)`;
  }

  return `${months} mês(es)`;
}

module.exports = {
  getAccountAge
};