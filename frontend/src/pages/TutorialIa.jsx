// Demonstração animada de como usar a IA no Telegram (rota /tutorial-ia). Não é um arquivo de vídeo: a conversa é
// desenhada aqui, então para mudar o conteúdo basta editar CAPITULOS. Os textos do bot seguem os de
// backend/src/assistente.js e backend/src/acoes.js: se eles mudarem, atualize aqui também. Os dados são fictícios.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Check, Pause, Play, RotateCcw, Send } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { buttonPrimary, buttonSecondary, card } from "../ui.js";

const legenda = (texto, duracao = 1800) => ({ tipo: "legenda", texto, duracao });
const digitar = (texto) => ({ tipo: "digitar", texto });
const bot = (conteudo, botoes) => ({ tipo: "bot", conteudo, botoes });
const tocar = (rotulo) => ({ tipo: "tocar", rotulo });

const Linha = ({ children }) => <span className="block">{children}</span>;
const Recuo = ({ children }) => <span className="block pl-3">{children}</span>;
const Link2 = ({ children }) => <span className="block font-bold text-sky-700">{children}</span>;

const CAPITULOS = [
  {
    titulo: "Perguntar sobre a agenda",
    resumo: "Escreva como falaria com um colega.",
    passos: [
      legenda("Escreva a pergunta como falaria com um colega. Não precisa de comando."),
      digitar("quem tem entrevista amanhã?"),
      bot(
        <>
          <Linha><b>Agenda de terça-feira, 04/11</b></Linha>
          <Linha>🕗 09:30 · <b>Loja Exemplo</b> · Ana Souza</Linha>
          <Recuo>Estágio em Marketing · ⏳ sem confirmação</Recuo>
          <Linha>🕗 14:00 · <b>Clínica Modelo</b> · Bruno Lima</Linha>
          <Recuo>Estágio em Administração · ✅ confirmada</Recuo>
          <Link2>Abrir o calendário</Link2>
        </>,
      ),
      legenda("A resposta vem direto do banco do painel. A IA só entendeu o que você pediu, sem ver esses dados.", 3600),
    ],
  },
  {
    titulo: "Procurar uma pessoa",
    resumo: "Contato e situação de quem você citar.",
    passos: [
      legenda("Use o nome completo sempre que puder, com acentos. Assim a busca acerta de primeira."),
      digitar("me passa o contato da Ana Souza"),
      bot(
        <>
          <Linha>🎓 <b>Ana Souza</b></Linha>
          <Recuo>Marketing · Belo Horizonte</Recuo>
          <Recuo>📞 (31) 90000-0000</Recuo>
          <Recuo>• Estágio em Marketing: Em Entrevista</Recuo>
          <Recuo><Link2>Ver perfil</Link2></Recuo>
        </>,
      ),
      legenda("Cada mensagem é independente: o bot não lembra da anterior. Repita o nome na próxima pergunta.", 3400),
    ],
  },
  {
    titulo: "Registrar um contato",
    resumo: "Conte o que aconteceu. Você confirma antes de salvar.",
    passos: [
      legenda("Depois de falar com alguém, é só contar o que aconteceu."),
      digitar("liguei para a Ana Souza, ela confirmou. Retornar dia 10/11"),
      bot(
        <>
          <Linha><b>Confirma o registro?</b></Linha>
          <Linha><b>Ana Souza</b> · Ligação</Linha>
          <Linha>“ela confirmou”</Linha>
          <Linha>Retorno em 10/11/2026</Linha>
        </>,
        ["✅ Confirmar", "Cancelar"],
      ),
      legenda("Confira o resumo: é exatamente isto que será salvo. Nada é gravado antes do seu toque.", 3400),
      tocar("✅ Confirmar"),
      bot(<Linha>✅ Contato registrado para <b>Ana Souza</b>.</Linha>),
      legenda("Pronto. O contato aparece no perfil dela, com o seu nome, e o retorno vira um aviso no dia combinado.", 3400),
    ],
  },
  {
    titulo: "Mover um candidato",
    resumo: "Mude a etapa do Kanban, com aviso do que muda junto.",
    passos: [
      legenda("Você também pode mudar a etapa de um candidato no Kanban."),
      digitar("passa a Ana Souza para Em Teste"),
      bot(
        <>
          <Linha><b>Confirma a mudança?</b></Linha>
          <Linha><b>Ana Souza</b></Linha>
          <Linha>Nº 12345 · Estágio em Marketing · Loja Exemplo</Linha>
          <Linha>Em Entrevista → <b>Em Teste</b></Linha>
          <Linha>⚠️ A entrevista ficará como realizada.</Linha>
        </>,
        ["✅ Confirmar", "Cancelar"],
      ),
      legenda("O ⚠️ avisa o que mais muda junto. Se algo estiver errado, toque em Cancelar.", 3200),
      tocar("✅ Confirmar"),
      bot(
        <>
          <Linha>✅ <b>Ana Souza</b> agora está em <b>Em Teste</b>.</Linha>
          <Link2>Abrir o Kanban</Link2>
        </>,
      ),
      legenda("Em Entrevista e Dispensado continuam no painel, porque pedem data ou motivo.", 3200),
    ],
  },
  {
    titulo: "Pedir um texto pronto",
    resumo: "Mensagens para copiar, marcadas com 🤖.",
    passos: [
      legenda("A IA também escreve mensagens para você adaptar e enviar."),
      digitar("escreva uma mensagem pedindo o currículo"),
      bot(
        <>
          <Linha>🤖 Olá, {"{primeiro_nome}"}! Tudo bem?</Linha>
          <Linha>Para seguir com sua candidatura à vaga de {"{vaga}"}, pode me enviar seu currículo atualizado?</Linha>
          <Linha>Obrigado!</Linha>
        </>,
      ),
      legenda("O 🤖 marca o que foi escrito pela IA: leia e ajuste antes de usar. Troque o que está entre chaves pelos dados reais.", 4200),
    ],
  },
];

const EXEMPLOS = [
  ["O que tenho hoje?", "Mostra as entrevistas e os eventos do dia."],
  ["O que está pendente?", "Lista urgências, retornos e contratos."],
  ["Quais vagas estão abertas?", "Lista as vagas, as mais antigas primeiro."],
  ["Como foi a semana?", "Mostra candidaturas, contratações e dispensas."],
  ["Mandei WhatsApp para a Ana Souza e ela não respondeu", "Prepara o registro do contato para você confirmar."],
  ["Contrata o Bruno Lima", "Prepara a mudança para Contratado para você confirmar."],
];

const CANCELADO = Symbol("cancelado");
let proximoId = 0;

export default function TutorialIaPage() {
  const [estado, setEstado] = useState("inicio"); // inicio | tocando | pausado | fim
  const [capitulo, setCapitulo] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [textoLegenda, setTextoLegenda] = useState("Toque em Assistir para ver como funciona.");
  const [mensagens, setMensagens] = useState([]);
  const [digitando, setDigitando] = useState("");
  const [botEscrevendo, setBotEscrevendo] = useState(false);
  const chat = useRef(null);
  const execucao = useRef(0);
  const tocando = useRef(false);

  // Tempo que respeita a pausa e para na hora quando outra execução começa (ou a tela é fechada).
  const esperar = useCallback(async (ms, id) => {
    let falta = ms;
    while (falta > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (execucao.current !== id) throw CANCELADO;
      if (tocando.current) falta -= 50;
    }
  }, []);

  const executarPasso = useCallback(async (passo, id) => {
    if (passo.tipo === "legenda") {
      setTextoLegenda(passo.texto);
      await esperar(passo.duracao, id);
    } else if (passo.tipo === "digitar") {
      for (let i = 1; i <= passo.texto.length; i++) {
        setDigitando(passo.texto.slice(0, i));
        await esperar(40, id);
      }
      await esperar(500, id);
      setDigitando("");
      setMensagens((atuais) => [...atuais, { id: ++proximoId, minha: true, conteudo: passo.texto }]);
      await esperar(400, id);
    } else if (passo.tipo === "bot") {
      setBotEscrevendo(true);
      await esperar(1200, id);
      setBotEscrevendo(false);
      setMensagens((atuais) => [...atuais, { id: ++proximoId, conteudo: passo.conteudo, botoes: passo.botoes }]);
      await esperar(600, id);
    } else if (passo.tipo === "tocar") {
      setMensagens((atuais) => atuais.map((m) => (m.botoes ? { ...m, tocado: passo.rotulo } : m)));
      await esperar(800, id);
      // Como no bot de verdade: depois do toque, os botões somem da mensagem.
      setMensagens((atuais) => atuais.map((m) => (m.botoes ? { ...m, botoes: null, tocado: null } : m)));
      await esperar(300, id);
    }
  }, [esperar]);

  const rodar = useCallback(async (inicio) => {
    const id = ++execucao.current;
    tocando.current = true;
    setEstado("tocando");
    setMensagens([]);
    setDigitando("");
    setBotEscrevendo(false);
    try {
      for (let c = inicio; c < CAPITULOS.length; c++) {
        setCapitulo(c);
        setProgresso(0);
        const { passos } = CAPITULOS[c];
        for (let p = 0; p < passos.length; p++) {
          await executarPasso(passos[p], id);
          setProgresso((p + 1) / passos.length);
        }
        await esperar(800, id);
      }
      tocando.current = false;
      setEstado("fim");
      setTextoLegenda("Fim. Agora é só testar no seu Telegram, começando por /ajuda.");
    } catch (erro) {
      if (erro !== CANCELADO) throw erro;
    }
  }, [esperar, executarPasso]);

  // Fechar a tela cancela a execução em andamento.
  useEffect(() => () => { execucao.current = -1; }, []);

  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [mensagens, botEscrevendo]);

  const alternar = () => {
    if (estado === "inicio" || estado === "fim") return rodar(0);
    tocando.current = estado === "pausado";
    return setEstado(estado === "pausado" ? "tocando" : "pausado");
  };

  const emPausa = estado === "pausado";
  const parado = estado === "inicio" || estado === "fim";

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link to="/treinamento?modulo=telegram" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-marinho-700 hover:text-marinho-900">
          <ArrowLeft size={16} /> Voltar ao Treinamento
        </Link>
        <PageHeader subtitle="Demonstração de como conversar com o bot. Os nomes e dados são fictícios." />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="relative flex h-[560px] max-h-[75vh] flex-col overflow-hidden rounded-[28px] border-[6px] border-marinho-900 bg-[#dfe9ef] shadow-lg">
              <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-3 py-2">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-marinho-900 text-xs font-extrabold text-ambar-400">SE</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-marinho-900">Super Estágios</p>
                  <p className="text-xs text-slate-500">{botEscrevendo ? "escrevendo..." : "bot"}</p>
                </div>
              </div>

              <div ref={chat} aria-hidden="true" className="flex-1 space-y-2 overflow-y-auto scroll-smooth p-3 text-[13px] leading-snug text-slate-900">
                {mensagens.map((m) => (
                  <div key={m.id} className={m.minha ? "flex justify-end" : ""}>
                    <div className={`max-w-[92%] rounded-xl px-2.5 py-1.5 shadow-sm ${m.minha ? "rounded-br-sm bg-[#e1f7cf]" : "w-fit rounded-bl-sm bg-white"}`}>{m.conteudo}</div>
                    {m.botoes && (
                      <div className="mt-1 flex max-w-[92%] gap-1">
                        {m.botoes.map((rotulo) => (
                          <span
                            key={rotulo}
                            className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-all ${
                              m.tocado === rotulo ? "scale-95 bg-ambar-400 text-marinho-900 ring-4 ring-ambar-400/50" : "bg-marinho-900/70 text-white"
                            }`}
                          >
                            {rotulo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {botEscrevendo && (
                  <div className="flex w-fit gap-1 rounded-xl rounded-bl-sm bg-white px-3 py-2.5 shadow-sm">
                    {[0, 150, 300].map((atraso) => (
                      <span key={atraso} style={{ animationDelay: `${atraso}ms` }} className="size-1.5 animate-pulse rounded-full bg-slate-400" />
                    ))}
                  </div>
                )}
              </div>

              <div aria-hidden="true" className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
                <p className={`min-h-5 flex-1 truncate text-[13px] ${digitando ? "text-slate-900" : "text-slate-400"}`} dir={digitando ? "rtl" : undefined}>
                  {digitando ? <bdi>{digitando}</bdi> : "Mensagem"}
                </p>
                <Send size={18} className={digitando ? "text-sky-600" : "text-slate-300"} />
              </div>

              {parado && (
                <div className="absolute inset-0 grid place-items-center bg-marinho-950/55 backdrop-blur-[1px]">
                  <button type="button" onClick={alternar} className={`${buttonPrimary} h-12 px-6 text-base`}>
                    {estado === "fim" ? <RotateCcw size={19} /> : <Play size={19} />}
                    {estado === "fim" ? "Assistir de novo" : "Assistir"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={alternar} disabled={parado} className={buttonSecondary}>
                {emPausa ? <Play size={16} /> : <Pause size={16} />}
                {emPausa ? "Continuar" : "Pausar"}
              </button>
              <button type="button" onClick={() => rodar(0)} className={buttonSecondary}>
                <RotateCcw size={16} /> Do início
              </button>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className={`${card} border-l-4 border-l-ambar-400 p-4`} aria-live="polite">
              <p className="min-h-[3rem] text-base font-semibold text-marinho-900">{textoLegenda}</p>
            </div>

            <ol className={`${card} divide-y divide-slate-100`}>
              {CAPITULOS.map((item, indice) => {
                const atual = indice === capitulo && !parado;
                const preenchido = atual ? progresso : (indice < capitulo || estado === "fim") ? 1 : 0;
                return (
                  <li key={item.titulo}>
                    <button
                      type="button"
                      onClick={() => rodar(indice)}
                      aria-current={atual ? "step" : undefined}
                      className={`relative flex w-full items-start gap-3 overflow-hidden px-4 py-3 text-left transition-colors hover:bg-marinho-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ambar-400 ${atual ? "bg-ambar-50" : ""}`}
                    >
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${preenchido === 1 ? "bg-marinho-900 text-white" : "bg-slate-100 text-marinho-800"}`}>
                        {preenchido === 1 ? <Check size={13} /> : indice + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-marinho-900">{item.titulo}</span>
                        <span className="block text-xs text-slate-600">{item.resumo}</span>
                      </span>
                      <span aria-hidden="true" style={{ width: `${preenchido * 100}%` }} className="absolute bottom-0 left-0 h-0.5 bg-ambar-400 transition-[width] duration-300" />
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className={`${card} flex gap-3 p-4 text-sm text-slate-700`}>
              <Bot size={20} className="mt-0.5 shrink-0 text-marinho-700" />
              <p>
                A conversa livre depende da IA estar ligada no servidor. Envie <span className="font-mono text-xs font-bold">/ajuda</span> ao bot para conferir.
                Se ela estiver desligada ou no limite gratuito, os comandos continuam funcionando.
              </p>
            </div>
          </div>
        </div>

        <div className={`${card} mt-6 p-5`}>
          <h2 className="text-base font-extrabold text-marinho-900">Mais exemplos para testar</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {EXEMPLOS.map(([pergunta, resultado]) => (
              <div key={pergunta} className="rounded-md bg-slate-50 px-3 py-2.5">
                <dt className="text-sm font-bold text-marinho-900">“{pergunta}”</dt>
                <dd className="mt-0.5 text-xs text-slate-600">{resultado}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-5 text-base font-extrabold text-marinho-900">Cuidados</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>O que você digita vai para o serviço de IA, sem e-mails e números longos. Evite escrever dados sensíveis de candidatos.</li>
            <li>Leia o resumo antes de tocar em Confirmar. O botão vale por 10 minutos e uma vez só.</li>
            <li>São até 10 perguntas por minuto em texto livre. Os comandos não têm esse limite.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
