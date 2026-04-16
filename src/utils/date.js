function formatDate(dateString) {
  if (!dateString) return "Não informado";

  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(dateString) {
  if (!dateString) return "Não informado";

  const date = new Date(dateString);
  return date.toLocaleString("pt-BR");
}

module.exports = {
  formatDate,
  formatDateTime
};