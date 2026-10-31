// Área do curso, área da vaga e compatibilidade estudante × vaga (dicionário em src/areas.js).
//
// Área da vaga: cada palavra-chave achada no título vale 3 pontos; na descrição, 1 ponto por palavra diferente
// (no máximo 3); no setor da empresa, 1 ponto. A área precisa de pelo menos 2 pontos: uma palavra no título basta,
// mas na descrição são necessárias duas palavras (ou uma mais o setor). Com várias áreas, ficam as que têm ao menos
// metade dos pontos da mais forte. Sem nenhuma, a vaga fica com "área não identificada".
// Área manual (Vaga.area_manual), quando existe, substitui a detectada.
const { AREAS, IGNORAR } = require("./areas");

const PESOS = { titulo: 3, descricao: 1, setor: 1 };
const MAXIMO_DESCRICAO = 3;
const MINIMO_PONTOS = 2;

// Sem acentos, minúsculo e só letras/números separados por um espaço, com espaço nas pontas (busca por palavra inteira).
function textoBusca(texto) {
  const limpo = String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return ` ${limpo} `;
}

const areaPorId = new Map(AREAS.map((area) => [area.id, area]));

// Correlação nos dois sentidos, mesmo que só um lado a declare.
const correlatas = new Map(AREAS.map((area) => [area.id, new Set()]));
for (const area of AREAS) {
  for (const outra of area.correlatas) {
    if (!areaPorId.has(outra)) throw new Error(`areas.js: "${area.id}" cita a área correlata inexistente "${outra}".`);
    correlatas.get(area.id).add(outra);
    correlatas.get(outra).add(area.id);
  }
}

// Palavras das vagas da mais longa para a mais curta: a expressão longa "consome" o trecho, então
// "escritorio de advocacia" conta só para Jurídico e não também como "escritorio" (Atendimento).
const palavrasVaga = AREAS.flatMap((area) => area.palavras.map((palavra) => ({ area: area.id, texto: textoBusca(palavra) })))
  .sort((a, b) => b.texto.length - a.texto.length);
const trechosIgnorados = IGNORAR.map(textoBusca);

// Troca todas as ocorrências (inclusive vizinhas, que dividem o espaço) por um separador que não forma palavra.
function apagar(texto, trecho) {
  let atual = texto;
  while (atual.includes(trecho)) atual = atual.replaceAll(trecho, " # ");
  return atual;
}

// Áreas achadas num texto → Map(id da área → Set das palavras achadas).
function palavrasPorArea(texto) {
  let resto = textoBusca(texto);
  for (const trecho of trechosIgnorados) resto = apagar(resto, trecho);
  const achadas = new Map();
  for (const palavra of palavrasVaga) {
    if (!resto.includes(palavra.texto)) continue;
    if (!achadas.has(palavra.area)) achadas.set(palavra.area, new Set());
    achadas.get(palavra.area).add(palavra.texto.trim());
    resto = apagar(resto, palavra.texto);
  }
  return achadas;
}

const textoOrigens = { titulo: "pelo título", descricao: "pela descrição", setor: "pelo setor da empresa" };

function juntar(itens) {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

// Áreas detectadas na vaga, da mais forte para a mais fraca: [{ id, nome, pontos, origens, motivo }].
function detectarAreasVaga({ titulo, descricao, setor }) {
  const pontos = new Map();
  const somar = (campo, achadas, valor) => {
    for (const [id, palavras] of achadas) {
      const atual = pontos.get(id) ?? { pontos: 0, origens: [] };
      atual.pontos += valor(palavras);
      atual.origens.push(campo);
      pontos.set(id, atual);
    }
  };
  somar("titulo", palavrasPorArea(titulo), () => PESOS.titulo);
  somar("descricao", palavrasPorArea(descricao), (palavras) => Math.min(palavras.size, MAXIMO_DESCRICAO) * PESOS.descricao);
  somar("setor", palavrasPorArea(setor), () => PESOS.setor);

  const candidatas = [...pontos].filter(([, valor]) => valor.pontos >= MINIMO_PONTOS);
  const maior = Math.max(0, ...candidatas.map(([, valor]) => valor.pontos));
  return candidatas
    .filter(([, valor]) => valor.pontos * 2 >= maior)
    .sort(([idA, a], [idB, b]) => b.pontos - a.pontos || AREAS.indexOf(areaPorId.get(idA)) - AREAS.indexOf(areaPorId.get(idB)))
    .map(([id, valor]) => {
      const nome = areaPorId.get(id).nome;
      return { id, nome, pontos: valor.pontos, origens: valor.origens, motivo: `Área ${nome}, identificada ${juntar(valor.origens.map((origem) => textoOrigens[origem]))}` };
    });
}

// Área da vaga para as telas e para a compatibilidade.
//   areas      áreas que valem (a manual, se houver; senão as detectadas); vazio = "área não identificada"
//   manual     id da área corrigida pelo RH, ou null
//   detectadas o que o sistema achou sozinho (o formulário mostra mesmo quando há área manual)
function areaDaVaga(vaga) {
  const detectadas = detectarAreasVaga({ titulo: vaga.titulo, descricao: vaga.descricao, setor: vaga.empresa?.setor })
    .map(({ id, nome, motivo }) => ({ id, nome, motivo }));
  const manual = vaga.area_manual && areaPorId.has(vaga.area_manual) ? areaPorId.get(vaga.area_manual) : null;
  const areas = manual ? [{ id: manual.id, nome: manual.nome, motivo: `Área ${manual.nome}, definida manualmente pelo RH` }] : detectadas;
  return { areas, manual: manual?.id ?? null, detectadas };
}

// Área do curso do estudante: a expressão de curso mais longa que aparece no nome do curso
// ("Técnico em Informática" → Tecnologia, não o "técnico" genérico). Áreas de reserva só valem se nenhuma outra bater.
function areaDoCurso(curso) {
  const texto = textoBusca(curso);
  let melhor = null;
  for (const area of AREAS) {
    for (const nomeCurso of area.cursos) {
      const chave = textoBusca(nomeCurso);
      if (!texto.includes(chave)) continue;
      const forca = (area.reserva ? 0 : 1000) + chave.length;
      if (!melhor || forca > melhor.forca) melhor = { area, forca };
    }
  }
  return melhor ? { id: melhor.area.id, nome: melhor.area.nome } : null;
}

// Curso × área da vaga: "curso" (mesma área), "correlato" (área próxima) ou null.
function compararArea(areaCurso, areaVaga) {
  if (!areaCurso) return null;
  const mesma = areaVaga.areas.find((area) => area.id === areaCurso.id);
  if (mesma) return { tipo: "curso", motivo: mesma.motivo };
  const proxima = areaVaga.areas.find((area) => correlatas.get(areaCurso.id)?.has(area.id));
  if (proxima) return { tipo: "correlato", motivo: `${proxima.motivo}; correlata a ${areaCurso.nome}` };
  return null;
}

// Turno da vaga × disponibilidade do estudante. null = falta informação de um dos lados.
function confereDisponibilidade(disponibilidade, turnoVaga) {
  if (!turnoVaga || !disponibilidade?.length) return null;
  if (turnoVaga === "INTEGRAL") return disponibilidade.includes("MANHA") && disponibilidade.includes("TARDE");
  return disponibilidade.includes(turnoVaga);
}

// Turno da vaga × turno em que o estudante estuda. Noite e EAD não chocam com nenhum turno de vaga;
// quem estuda em período integral não tem turno livre.
const turnosOcupados = { MANHA: ["MANHA", "INTEGRAL"], TARDE: ["TARDE", "INTEGRAL"], NOITE: [], EAD: [], INTEGRAL: ["MANHA", "TARDE", "INTEGRAL"] };

function confereTurnoEstudo(turnoEstudo, turnoVaga) {
  if (!turnoVaga || !turnosOcupados[turnoEstudo]) return null;
  return !turnosOcupados[turnoEstudo].includes(turnoVaga);
}

// Cidade da vaga × cidade do estudante. Home office vale para qualquer cidade.
function confereCidade(estudante, vaga) {
  if (vaga.modalidade === "HOME_OFFICE") return true;
  const [cidadeVaga, cidadeEstudante] = [textoBusca(vaga.cidade).trim(), textoBusca(estudante.cidade).trim()];
  if (!cidadeVaga || !cidadeEstudante) return null;
  return cidadeVaga === cidadeEstudante;
}

const motivosFora = {
  disponibilidade: "Fora da disponibilidade do estudante",
  turno_estudo: "Choca com o turno em que o estudante estuda",
  cidade: "Em outra cidade",
};

// Separa as vagas abertas em que o estudante ainda não está: compatíveis (área igual ou correlata ao curso e
// nada de turno/disponibilidade/cidade em conflito; dado faltando não exclui) e as outras, com o motivo.
// semArea conta todas as vagas abertas sem área identificada (o aviso leva à tela de Vagas filtrada).
function separarVagas(estudante, vagas) {
  const areaCurso = areaDoCurso(estudante.curso);
  const inscritas = new Set((estudante.aplicacoes ?? []).map((aplicacao) => aplicacao.vaga_id));
  const turnoEstudo = estudante.turno_estudo ?? estudante.horario_estudo ?? null;
  const compativeis = [];
  const outras = [];
  let semArea = 0;

  for (const vaga of vagas) {
    if (vaga.status !== "ABERTA") continue;
    const area = areaDaVaga(vaga);
    if (area.areas.length === 0) semArea++;
    if (inscritas.has(vaga.id)) continue;

    const vagaComArea = { ...vaga, area };
    if (area.areas.length === 0) {
      outras.push({ vaga: vagaComArea, motivo: "Área não identificada" });
      continue;
    }
    const comparacao = compararArea(areaCurso, area);
    if (!comparacao) {
      outras.push({ vaga: vagaComArea, motivo: areaCurso ? "Área diferente do curso" : "Área do curso não identificada" });
      continue;
    }
    const checks = {
      disponibilidade: confereDisponibilidade(estudante.disponibilidade, vaga.turno),
      turno_estudo: confereTurnoEstudo(turnoEstudo, vaga.turno),
      cidade: confereCidade(estudante, vaga),
    };
    const conflito = Object.keys(checks).find((chave) => checks[chave] === false);
    if (conflito) {
      outras.push({ vaga: vagaComArea, motivo: motivosFora[conflito] });
      continue;
    }
    const confirmados = Object.values(checks).filter((valor) => valor === true).length;
    compativeis.push({ vaga: vagaComArea, ...comparacao, checks, confirmados });
  }

  const porTitulo = (a, b) => a.vaga.titulo.localeCompare(b.vaga.titulo, "pt-BR");
  compativeis.sort((a, b) => Number(a.tipo === "correlato") - Number(b.tipo === "correlato") || b.confirmados - a.confirmados || porTitulo(a, b));
  outras.sort(porTitulo);
  return { areaCurso, compativeis: compativeis.map(({ confirmados, ...item }) => item), outras, semArea };
}

const listaAreas = AREAS.map(({ id, nome }) => ({ id, nome }));

module.exports = { areaDaVaga, areaDoCurso, detectarAreasVaga, separarVagas, areaPorId, listaAreas, textoBusca };
