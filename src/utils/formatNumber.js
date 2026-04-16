function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

module.exports = {
  formatNumber
};