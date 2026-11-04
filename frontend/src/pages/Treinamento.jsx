// Treinamento (rota /treinamento): um módulo para cada parte do painel, com explicação simples e animação.
// As animações ficam em src/tutoriais/roteiros.jsx. O módulo escolhido fica na URL (?modulo=), então recarregar não perde o lugar.
// Tudo abre na mesma aba: não usar target="_blank" aqui.
import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Columns3,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Map,
  MousePointerClick,
  Settings,
  Smartphone,
  UserRound,
  UserRoundCheck,
  Users,
} from "lucide-react";
import TutorialPlayer from "../tutoriais/TutorialPlayer.jsx";
import { ROTEIROS } from "../tutoriais/roteiros.jsx";
import { buttonPrimary, buttonSecondary, card } from "../ui.js";

const MODULOS = [
  {
    id: "visao-geral",
    nome: "Como o painel funciona",
    icone: Map,
    serve: "Mostra o caminho completo: da empresa que pede um estagiário até o estudante contratado. Comece por aqui.",
    quando: ["Primeiro dia usando o painel.", "Para entender como as telas se ligam."],
    tutorial: "visaoGeral",
  },
  {
    id: "ferramentas",
    nome: "Ferramentas do topo",
    icone: MousePointerClick,
    serve: "Menu, Novo cadastro, busca e sino ficam disponíveis em todas as telas.",
    quando: ["Para cadastrar algo sem trocar de tela.", "Para achar uma pessoa, empresa ou vaga depressa."],
    tutorial: "ferramentas",
  },
  {
    id: "dashboard",
    nome: "Dashboard",
    icone: LayoutDashboard,
    serve: "É o resumo do trabalho: números, pendências e próximas entrevistas em um só lugar.",
    quando: ["Ao começar o dia, para ver o que pede atenção.", "Para saber como está o mês ou mostrar resultados."],
    tutorial: "dashboard",
    tela: "/",
  },
  {
    id: "empresas",
    nome: "Empresas",
    icone: Building2,
    serve: "É a lista dos clientes da Super Estágios, com os contatos de cada um. Toda vaga pertence a uma empresa.",
    quando: ["Chegou um cliente novo.", "Para registrar uma conversa com a empresa."],
    tutorial: "empresas",
    tela: "/empresas",
  },
  {
    id: "empresas-sem-vaga",
    nome: "Empresas sem vaga",
    icone: Building2,
    serve: "Mostra os clientes sem nenhuma vaga aberta agora. É a lista para buscar novos pedidos.",
    quando: ["Para ligar e perguntar se a empresa precisa de estagiários.", "Para combinar a data do próximo contato."],
    tutorial: "empresasSemVaga",
    tela: "/empresas-sem-vaga",
  },
  {
    id: "vagas",
    nome: "Vagas",
    icone: BriefcaseBusiness,
    serve: "São os pedidos das empresas. Cada vaga tem um número e um quadro próprio com os candidatos.",
    quando: ["Uma empresa pediu um estagiário.", "Para ver quais vagas estão abertas ou paradas."],
    tutorial: "vagas",
    tela: "/vagas",
  },
  {
    id: "estudantes",
    nome: "Estudantes",
    icone: GraduationCap,
    serve: "São todas as pessoas cadastradas, com ou sem vaga. O telefone não pode se repetir.",
    quando: ["Chegou um candidato novo.", "Para procurar alguém por nome, curso ou final do telefone."],
    tutorial: "estudantes",
    tela: "/estudantes",
  },
  {
    id: "perfil",
    nome: "Perfil do estudante",
    icone: UserRound,
    serve: "É a ficha completa de uma pessoa: dados, currículo, histórico e vagas que combinam com o curso dela.",
    quando: ["Antes de falar com o candidato.", "Para indicar a pessoa para uma vaga."],
    tutorial: "perfil",
    tela: "/estudantes",
    telaNome: "Estudantes",
  },
  {
    id: "kanban",
    nome: "Kanban da vaga",
    icone: Columns3,
    serve: "É o quadro de uma vaga. Cada coluna é uma etapa, e mover o cartão registra o andamento do candidato.",
    quando: ["O candidato avançou ou saiu do processo.", "Para marcar uma entrevista."],
    tutorial: "kanban",
    tela: "/vagas",
    telaNome: "Vagas",
  },
  {
    id: "calendario",
    nome: "Calendário",
    icone: CalendarDays,
    serve: "Reúne as entrevistas e os compromissos da equipe. As entrevistas marcadas no Kanban aparecem sozinhas.",
    quando: ["Para ver a agenda do dia ou da semana.", "Para confirmar, reagendar ou registrar o resultado de uma entrevista."],
    tutorial: "calendario",
    tela: "/calendario",
  },
  {
    id: "banco-de-talentos",
    nome: "Banco de Talentos",
    icone: Users,
    serve: "Guarda quem foi dispensado de alguma vaga e ainda não foi contratado. São candidatos que já conhecemos.",
    quando: ["Abriu uma vaga nova e você procura candidatos.", "Antes de buscar pessoas novas."],
    tutorial: "bancoTalentos",
    tela: "/banco-de-talentos",
  },
  {
    id: "contratacoes",
    nome: "Contratações Efetivas",
    icone: UserRoundCheck,
    serve: "Lista quem foi contratado e ajuda a acompanhar o estágio: contrato, TCE, seguro e relatórios.",
    quando: ["Depois de uma contratação, para guardar os dados do estágio.", "Para ver o que está pendente nos estágios."],
    tutorial: "contratacoes",
    tela: "/contratacoes",
  },
  {
    id: "relatorio",
    nome: "Relatório da empresa",
    icone: FileText,
    serve: "É um resumo das vagas e contratações de um cliente, pronto para imprimir ou salvar em PDF.",
    quando: ["Para prestar contas a um cliente."],
    tutorial: "relatorio",
    tela: "/empresas",
    telaNome: "Empresas",
  },
  {
    id: "configuracoes",
    nome: "Configurações",
    icone: Settings,
    serve: "Guarda os modelos de mensagem, a conexão com o celular e, para quem administra, a meta e os usuários.",
    quando: ["Para criar um texto pronto de mensagem.", "Para conectar o seu Telegram."],
    tutorial: "configuracoes",
    tela: "/configuracoes",
  },
  {
    id: "telegram",
    nome: "IA no Telegram",
    icone: Smartphone,
    serve: "Um assistente no celular: avisa o que é importante e responde perguntas sobre agenda, vagas e candidatos.",
    quando: ["Fora do computador, para consultar algo rápido.", "Para registrar uma ligação logo depois de fazer."],
    extra: { texto: "Ver a demonstração", destino: "/tutorial-ia" },
  },
];

export default function TreinamentoPage() {
  const [parametros, setParametros] = useSearchParams();
  const conteudo = useRef(null);
  const encontrado = MODULOS.findIndex((item) => item.id === parametros.get("modulo"));
  const indice = encontrado < 0 ? 0 : encontrado;
  const modulo = MODULOS[indice];
  const anterior = MODULOS[indice - 1];
  const proximo = MODULOS[indice + 1];
  const Icone = modulo.icone;
  const primeiraVez = useRef(true);

  // No celular a lista fica embaixo: ao escolher um módulo, leva a pessoa de volta ao conteúdo.
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    conteudo.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [indice]);

  const abrir = (item) => setParametros({ modulo: item.id });

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div ref={conteudo} className={`${card} min-w-0 scroll-mt-20 p-5 sm:p-6`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Módulo {indice + 1} de {MODULOS.length}</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-extrabold text-marinho-900">
            <Icone size={22} className="shrink-0 text-marinho-700" /> {modulo.nome}
          </h2>

          <h3 className="mt-4 text-sm font-extrabold text-marinho-900">Para que serve</h3>
          <p className="mt-1 text-sm text-slate-700">{modulo.serve}</p>

          <h3 className="mt-4 text-sm font-extrabold text-marinho-900">Quando usar</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {modulo.quando.map((texto) => <li key={texto}>{texto}</li>)}
          </ul>

          {modulo.tutorial && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-extrabold text-marinho-900">Veja como funciona</h3>
              {/* key: trocar de módulo recomeça a animação do primeiro passo. */}
              <TutorialPlayer key={modulo.id} passos={ROTEIROS[modulo.tutorial]} />
            </>
          )}

          {modulo.extra && (
            <Link to={modulo.extra.destino} className={`${buttonSecondary} mt-5`}>
              <ExternalLink size={16} /> {modulo.extra.texto}
            </Link>
          )}

          {modulo.tela && (
            <p className="mt-4 text-sm">
              <Link to={modulo.tela} className="font-bold text-marinho-700 underline underline-offset-2 hover:text-marinho-900">
                Abrir {modulo.telaNome ?? modulo.nome}
              </Link>
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            {anterior ? (
              <button type="button" onClick={() => abrir(anterior)} className={buttonSecondary}><ArrowLeft size={16} /> Anterior</button>
            ) : <span />}
            {proximo ? (
              <button type="button" onClick={() => abrir(proximo)} className={buttonPrimary}>Próximo: {proximo.nome} <ArrowRight size={16} /></button>
            ) : (
              <p className="self-center text-sm font-bold text-marinho-900">Você chegou ao fim do treinamento. 🎉</p>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-3">
          <nav aria-label="Módulos do treinamento" className={card}>
            <ol className="divide-y divide-slate-100">
              {MODULOS.map((item, posicao) => {
                const ItemIcone = item.icone;
                const atual = posicao === indice;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => abrir(item)}
                      aria-current={atual ? "step" : undefined}
                      className={`flex w-full items-center gap-2.5 border-l-4 px-3 py-2.5 text-left text-sm transition-colors hover:bg-marinho-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ambar-400 ${
                        atual ? "border-ambar-400 bg-ambar-50 font-bold text-marinho-900" : "border-transparent font-semibold text-slate-700"
                      }`}
                    >
                      <ItemIcone size={16} className="shrink-0 text-marinho-700" />
                      <span className="min-w-0">{item.nome}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <a href="/ajuda/manual.html" className={`${card} flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50`}>
            <BookOpen size={16} className="shrink-0" /> Prefere ler? Veja o manual completo
          </a>
        </aside>
      </div>
    </section>
  );
}
