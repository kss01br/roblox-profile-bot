const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function calculateWeightedScore(criteria) {
  const weights = {
    identidade_visual: 20,
    coerencia_outfit: 20,
    paleta_cores: 15,
    criatividade: 15,
    presenca_visual: 15,
    acabamento: 10,
    proporcao_equilibrio: 5,
  };

  let total = 0;
  let weightSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = clamp(toNumber(criteria[key], 0));
    total += score * weight;
    weightSum += weight;
  }

  return round1(total / weightSum);
}

function getRank(score) {
  if (score >= 9.5) return "SS";
  if (score >= 8.5) return "S";
  if (score >= 7.0) return "A";
  if (score >= 5.5) return "B";
  if (score >= 4.0) return "C";
  return "D";
}

function normalizeReview(data) {
  const criterios = {
    identidade_visual: clamp(toNumber(data?.criterios?.identidade_visual, 0)),
    coerencia_outfit: clamp(toNumber(data?.criterios?.coerencia_outfit, 0)),
    paleta_cores: clamp(toNumber(data?.criterios?.paleta_cores, 0)),
    criatividade: clamp(toNumber(data?.criterios?.criatividade, 0)),
    presenca_visual: clamp(toNumber(data?.criterios?.presenca_visual, 0)),
    acabamento: clamp(toNumber(data?.criterios?.acabamento, 0)),
    proporcao_equilibrio: clamp(toNumber(data?.criterios?.proporcao_equilibrio, 0)),
  };

  const notaFinal = calculateWeightedScore(criterios);
  const rank = getRank(notaFinal);

  return {
    nota_final: notaFinal,
    rank,
    criterios,
    resumo: typeof data?.resumo === "string" ? data.resumo : "Sem resumo.",
    pontos_fortes: Array.isArray(data?.pontos_fortes) ? data.pontos_fortes.slice(0, 5) : [],
    pontos_fracos: Array.isArray(data?.pontos_fracos) ? data.pontos_fracos.slice(0, 5) : [],
    sugestao: typeof data?.sugestao === "string" ? data.sugestao : "Sem sugestão.",
  };
}

async function reviewAvatarImage({ imageUrl, username, displayName, modo = "padrao" }) {
  const modoInstrucao = {
    padrao: "Seja equilibrado, justo e consistente.",
    rigoroso: "Seja mais exigente. Nota alta só para avatar realmente excepcional.",
    casual: "Seja um pouco mais leve e divertido, mas mantenha coerência nas notas.",
  }[modo] || "Seja equilibrado, justo e consistente.";

  const prompt = `
Você é um crítico especializado em avaliação estética de avatars do Roblox.

Sua função é analisar SOMENTE o visual do avatar da imagem.
Não invente:
- valor monetário
- raridade real
- inventário
- quanto gastou em Robux
- status social
- poder no jogo

Avalie com rigor usando esta rubrica:

1. identidade_visual (0-10) peso 20
2. coerencia_outfit (0-10) peso 20
3. paleta_cores (0-10) peso 15
4. criatividade (0-10) peso 15
5. presenca_visual (0-10) peso 15
6. acabamento (0-10) peso 10
7. proporcao_equilibrio (0-10) peso 5

Definições:
- identidade_visual: força da personalidade e assinatura visual
- coerencia_outfit: harmonia entre roupas, acessórios e conceito
- paleta_cores: equilíbrio e compatibilidade das cores
- criatividade: originalidade e diferenciação
- presenca_visual: impacto ao olhar
- acabamento: refinamento e polimento do visual
- proporcao_equilibrio: distribuição visual equilibrada dos elementos

Instrução de estilo:
${modoInstrucao}

Regras:
- use uma casa decimal
- seja específico
- não sexualize
- escreva em português do Brasil
- cite ${displayName} ou @${username} no resumo se ficar natural
- responda APENAS em JSON válido
- NÃO calcule a nota_final
- NÃO calcule rank
- devolva somente os critérios + análise textual

Formato obrigatório:
{
  "criterios": {
    "identidade_visual": 0,
    "coerencia_outfit": 0,
    "paleta_cores": 0,
    "criatividade": 0,
    "presenca_visual": 0,
    "acabamento": 0,
    "proporcao_equilibrio": 0
  },
  "resumo": "",
  "pontos_fortes": ["", "", ""],
  "pontos_fracos": ["", "", ""],
  "sugestao": ""
}
`;

  const response = await openai.responses.create({
    model: "gpt-5.4",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "high",
          },
        ],
      },
    ],
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("A IA não retornou conteúdo.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida da IA:\n${text}`);
  }

  return normalizeReview(parsed);
}

module.exports = {
  reviewAvatarImage,
  calculateWeightedScore,
  getRank,
};