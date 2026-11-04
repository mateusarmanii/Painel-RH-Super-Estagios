// Qual tutorial "Como usar" corresponde a cada tela. Separado dos roteiros para o menu não carregar os desenhos à toa.
// A demonstração da IA (/tutorial-ia) já é um tutorial, então não tem botão. A ordem importa: o prefixo mais específico vem antes.
const ROTAS = [
  ["/vagas", "vagas"],
  ["/kanban", "kanban"],
  ["/calendario", "calendario"],
  ["/empresas-sem-vaga", "empresasSemVaga"],
  ["/empresas", "empresas"],
  ["/estudantes/", "perfil"],
  ["/estudantes", "estudantes"],
  ["/banco-de-talentos", "bancoTalentos"],
  ["/contratacoes", "contratacoes"],
  ["/configuracoes", "configuracoes"],
  ["/relatorios/empresa", "relatorio"],
];

export function tutorialDaTela(pathname) {
  if (pathname === "/") return "dashboard";
  return ROTAS.find(([prefixo]) => pathname.startsWith(prefixo))?.[1] ?? null;
}
