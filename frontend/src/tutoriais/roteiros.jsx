// Roteiros dos tutoriais "Como usar", um por tela. Cada passo tem a legenda, a mini-tela e, se houver, o alvo do cursor.
// Os dados são fictícios. Os nomes de botões seguem as telas reais e o manual (public/ajuda/manual.html):
// ao renomear algo no painel, atualize aqui também.
import { Bell, MoreHorizontal, Plus, Search } from "lucide-react";
import { Alvo } from "./TutorialPlayer.jsx";

const TONS = {
  cinza: "bg-slate-100 text-slate-700",
  azul: "bg-sky-100 text-sky-800",
  ambar: "bg-ambar-100 text-marinho-900",
  verde: "bg-emerald-100 text-emerald-800",
  rosa: "bg-rose-100 text-rose-800",
};

const Selo = ({ tom = "cinza", children }) => <span className={`inline-block rounded-full px-1.5 py-px text-[10px] font-bold ${TONS[tom]}`}>{children}</span>;

const Botao = ({ id, primario, children }) => {
  const botao = <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 font-bold ${primario ? "border-ambar-400 bg-ambar-400 text-marinho-900" : "border-slate-300 bg-white text-marinho-800"}`}>{children}</span>;
  return id ? <Alvo id={id} className="inline-block">{botao}</Alvo> : botao;
};

const Busca = ({ id = "busca", texto = "Buscar" }) => (
  <Alvo id={id} className="min-w-0 flex-1">
    <span className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-500"><Search size={11} className="shrink-0" /><span className="truncate">{texto}</span></span>
  </Alvo>
);

const Barra = ({ children }) => <div className="mb-2 flex flex-wrap items-center gap-1.5">{children}</div>;

const Cartao = ({ id, titulo, sub, children, direita }) => {
  const cartao = (
    <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-marinho-900">{titulo}</p>
          {sub && <p className="truncate text-[10px] text-slate-500">{sub}</p>}
        </div>
        {direita}
      </div>
      {children && <div className="mt-1.5 flex flex-wrap items-center gap-1">{children}</div>}
    </div>
  );
  return id ? <Alvo id={id}>{cartao}</Alvo> : cartao;
};

const Lista = ({ children }) => <div className="space-y-1.5">{children}</div>;

const Janela = ({ titulo, children }) => (
  <div className="mx-auto max-w-[280px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
    <p className="bg-ambar-400 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-marinho-900">{titulo}</p>
    <div className="space-y-1.5 p-2">{children}</div>
  </div>
);

const Campo = ({ id, rotulo, valor }) => {
  const campo = (
    <div>
      <p className="text-[10px] font-bold text-slate-600">{rotulo}</p>
      <p className="truncate rounded border border-slate-300 px-1.5 py-0.5 text-slate-800">{valor}</p>
    </div>
  );
  return id ? <Alvo id={id}>{campo}</Alvo> : campo;
};

const Menu = ({ itens }) => (
  <div className="ml-auto w-fit rounded-md border border-slate-200 bg-white py-1 shadow-md">
    {itens.map(([id, texto]) => <Alvo key={texto} id={id}><p className="px-2.5 py-1 font-semibold text-marinho-900">{texto}</p></Alvo>)}
  </div>
);

const Tres = <MoreHorizontal size={14} className="shrink-0 text-slate-500" />;

const NovoCadastro = ({ tipo }) => (
  <>
    <Barra><Botao id="novo" primario><Plus size={11} /> Novo cadastro</Botao></Barra>
    <div className="w-fit rounded-md border border-slate-200 bg-white py-1 shadow-md">
      {["Empresa", "Vaga", "Estudante"].map((item) => <Alvo key={item} id={item === tipo ? "tipo" : undefined}><p className="px-2.5 py-1 font-semibold text-marinho-900">{item}</p></Alvo>)}
    </div>
  </>
);

// ---------- Kanban ----------

const Coluna = ({ titulo, tom, children }) => (
  <div className="w-[31%] min-w-0 shrink-0 rounded-md bg-slate-100 p-1">
    <p className="mb-1 truncate"><Selo tom={tom}>{titulo}</Selo></p>
    <div className="space-y-1">{children}</div>
  </div>
);

const CartaoKanban = ({ id, nome, children }) => {
  const cartao = <div className="rounded bg-white p-1 shadow-sm"><p className="truncate font-bold text-marinho-900">{nome}</p>{children}</div>;
  return id ? <Alvo id={id}>{cartao}</Alvo> : cartao;
};

const Quadro = ({ anaEm = "Candidato Contatado" }) => (
  <>
    <Barra>
      <Busca texto="Buscar no quadro" />
      <Botao id="selecionar">Selecionar</Botao>
      <Botao id="sugerir">Sugerir candidatos</Botao>
    </Barra>
    <div className="flex gap-1">
      <Coluna titulo="Candidato Contatado" tom="cinza">
        {anaEm === "Candidato Contatado" && <CartaoKanban id="ana" nome="Ana Souza" />}
        <CartaoKanban nome="Caio Dias" />
      </Coluna>
      <Coluna titulo="Enviado à Empresa" tom="azul">
        {anaEm === "Enviado à Empresa" && <CartaoKanban id="ana" nome="Ana Souza" />}
        <CartaoKanban nome="Bruno Lima" />
      </Coluna>
      <Coluna titulo="Em Entrevista" tom="ambar"><CartaoKanban nome="Duda Reis"><p className="text-[10px] text-slate-500">04/11 às 09:30</p></CartaoKanban></Coluna>
    </div>
  </>
);

// ---------- Calendário ----------

const Calendario = () => (
  <>
    <Barra><Botao>Dia</Botao><Botao>Semana</Botao><Botao>Mês</Botao><Botao>Lista</Botao><span className="ml-auto" /><Botao id="evento" primario><Plus size={11} /> Novo evento</Botao></Barra>
    <Lista>
      <Cartao id="entrevista" titulo="09:30 · Loja Exemplo · Ana Souza" sub="Estágio em Marketing"><Selo tom="ambar">Aguardando</Selo></Cartao>
      <Cartao titulo="14:00 · Clínica Modelo · Bruno Lima" sub="Estágio em Administração"><Selo tom="verde">Confirmada</Selo></Cartao>
    </Lista>
  </>
);

const PainelEntrevista = () => (
  <Janela titulo="Entrevista · Ana Souza">
    <p className="text-[10px] text-slate-600">Loja Exemplo · 04/11 às 09:30</p>
    <Alvo id="whats"><Botao>Pedir confirmação pelo WhatsApp</Botao></Alvo>
    <div className="flex flex-wrap gap-1">
      <Botao id="confirmar">Confirmar</Botao>
      <Botao id="realizada">Realizada</Botao>
      <Botao>Não compareceu</Botao>
      <Botao id="reagendar">Reagendar</Botao>
    </div>
  </Janela>
);

// ---------- Empresas e estudantes ----------

const ListaEmpresas = () => (
  <>
    <Barra><Busca texto="Buscar empresa" /></Barra>
    <Lista>
      <Cartao titulo="Loja Exemplo" sub="Varejo · Marina · (31) 90000-0000" direita={<Alvo id="menu">{Tres}</Alvo>}><Selo tom="azul">2 vagas abertas</Selo></Cartao>
      <Cartao titulo="Clínica Modelo" sub="Saúde · Paulo · (31) 90000-0001" direita={Tres}><Selo>1 vaga aberta</Selo></Cartao>
    </Lista>
  </>
);

const RegistroContato = ({ quem }) => (
  <Janela titulo={`Contatos e anotações · ${quem}`}>
    <Campo rotulo="Tipo" valor="Ligação" />
    <Campo rotulo="Anotação" valor="Pediu retorno sobre nova vaga" />
    <Campo id="proximo" rotulo="Próximo contato" valor="10/11/2026" />
    <Botao primario>Salvar</Botao>
  </Janela>
);

const ListaEstudantes = ({ busca = "Buscar por nome, curso ou telefone" }) => (
  <>
    <Barra><Busca texto={busca} /><Botao id="filtros">Filtros</Botao></Barra>
    <Lista>
      <Cartao id="estudante" titulo="Ana Souza" sub="Marketing · Belo Horizonte · (31) 90000-1234" direita={Tres}><Selo tom="ambar">Em processo</Selo></Cartao>
      <Cartao titulo="Bruno Lima" sub="Administração · Contagem · (31) 90000-5678" direita={Tres}><Selo>Sem candidatura</Selo></Cartao>
    </Lista>
  </>
);

// ---------- Visão geral e ferramentas (usados no Treinamento) ----------

const ETAPAS_DO_CAMINHO = [
  ["empresa", "Empresa", "o cliente"],
  ["vaga", "Vaga", "o pedido do cliente"],
  ["estudante", "Estudante", "quem procura estágio"],
  ["kanban", "Kanban", "o andamento"],
  ["entrevista", "Entrevista", "dia e hora marcados"],
  ["contratado", "Contratado", "deu certo!"],
];

const Caminho = () => (
  <>
    <div className="grid grid-cols-3 gap-1.5">
      {ETAPAS_DO_CAMINHO.map(([id, titulo, sub], posicao) => (
        <Alvo key={id} id={id}>
          <div className="rounded-md border border-slate-200 bg-white p-1.5 text-center shadow-sm">
            <p className="font-bold text-marinho-900">{posicao + 1}. {titulo}</p>
            <p className="text-[10px] text-slate-500">{sub}</p>
          </div>
        </Alvo>
      ))}
    </div>
    <Alvo id="banco" className="mt-2">
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-1.5 text-center">
        <p className="font-bold text-marinho-900">Banco de Talentos</p>
        <p className="text-[10px] text-slate-500">quem não passou fica guardado para outra vaga</p>
      </div>
    </Alvo>
  </>
);

const TelaDoPainel = () => (
  <div className="flex h-full gap-2">
    <Alvo id="menu" className="h-full w-16 shrink-0">
      <div className="h-full space-y-1 rounded-md bg-marinho-900 p-1.5 text-[10px] font-bold text-slate-200">
        <p className="text-ambar-400">Dashboard</p>
        <p>Vagas</p>
        <p>Calendário</p>
        <p>Empresas</p>
        <p>Estudantes</p>
      </div>
    </Alvo>
    <div className="min-w-0 flex-1">
      <Barra>
        <Busca texto="Buscar estudante, empresa ou vaga" />
        <Alvo id="comoUsar" className="inline-block"><Botao>Como usar</Botao></Alvo>
        <Alvo id="sino" className="inline-block"><span className="grid size-6 place-items-center rounded-md border border-slate-300 bg-white"><Bell size={12} className="text-marinho-800" /></span></Alvo>
        <Botao id="novo" primario><Plus size={11} /> Novo cadastro</Botao>
      </Barra>
      <Cartao titulo="A tela escolhida aparece aqui" sub="Cada item do menu abre uma tela" />
    </div>
  </div>
);

// ---------- Roteiros ----------

export const ROTEIROS = {
  visaoGeral: [
    { legenda: "O painel acompanha o caminho do estudante até a contratação. Tudo começa com a Empresa, o nosso cliente.", alvo: "empresa", tela: <Caminho /> },
    { legenda: "A empresa pede um estagiário. Esse pedido vira uma Vaga, com um número próprio.", alvo: "vaga", tela: <Caminho /> },
    { legenda: "O Estudante é quem procura estágio. Cadastramos os dados dele e o ligamos a uma vaga.", alvo: "estudante", tela: <Caminho /> },
    { legenda: "Cada vaga tem um Kanban: um quadro que mostra em que etapa cada candidato está.", alvo: "kanban", tela: <Caminho /> },
    { legenda: "Quando marcamos uma Entrevista no Kanban, ela aparece sozinha no Calendário.", alvo: "entrevista", tela: <Caminho /> },
    { legenda: "A empresa aprovou? O candidato vira Contratado e passamos a acompanhar o estágio.", alvo: "contratado", tela: <Caminho /> },
    { legenda: "Quem não passou não se perde: fica no Banco de Talentos, pronto para outra vaga.", alvo: "banco", tela: <Caminho /> },
  ],

  ferramentas: [
    { legenda: "O menu da esquerda leva a cada parte do painel. No celular, ele abre pelo botão ☰.", alvo: "menu", tela: <TelaDoPainel /> },
    { legenda: "Novo cadastro cria uma Empresa, uma Vaga ou um Estudante, sem sair da tela em que você está.", alvo: "novo", tela: <TelaDoPainel /> },
    { legenda: "A busca acha estudantes, empresas e vagas. Digite o número da vaga e aperte Enter para abrir o Kanban dela.", alvo: "busca", tela: <TelaDoPainel /> },
    { legenda: "O sino mostra o que pede atenção, como entrevistas próximas e vagas paradas.", alvo: "sino", tela: <TelaDoPainel /> },
    { legenda: "Ficou com dúvida em alguma tela? “Como usar” mostra a animação daquela tela, sem você sair dela.", alvo: "comoUsar", tela: <TelaDoPainel /> },
  ],

  dashboard: [
    {
      legenda: "Escolha o período no topo. Todos os números e gráficos da tela acompanham a sua escolha.",
      alvo: "periodo",
      tela: (
        <>
          <Barra><Alvo id="periodo" className="inline-block"><Botao primario>30 dias</Botao></Alvo><Botao>7 dias</Botao><Botao>90 dias</Botao><Botao>Este mês</Botao></Barra>
          <div className="grid grid-cols-3 gap-1.5">
            {[["Vagas abertas", "12"], ["Candidaturas", "48"], ["Contratações", "6"]].map(([rotulo, valor]) => <Cartao key={rotulo} titulo={valor} sub={rotulo} />)}
          </div>
        </>
      ),
    },
    {
      legenda: "As pendências mostram o que pede ação hoje. Clique em uma para ir direto ao lugar certo.",
      alvo: "pendencia",
      tela: (
        <Lista>
          <Cartao id="pendencia" titulo="3 entrevistas sem confirmação" sub="Abrir o Calendário"><Selo tom="rosa">Pendência</Selo></Cartao>
          <Cartao titulo="Vaga parada: Estágio em Vendas" sub="12 dias sem entrevista"><Selo tom="ambar">Vaga parada</Selo></Cartao>
          <Cartao titulo="Próxima entrevista: 09:30" sub="Loja Exemplo · Ana Souza" />
        </Lista>
      ),
    },
    {
      legenda: "Clique numa área do gráfico para filtrar o Dashboard inteiro. Para voltar, use “Tirar o filtro desta área”.",
      alvo: "area",
      tela: (
        <>
          <Barra><Botao>Tirar o filtro desta área</Botao></Barra>
          <Cartao titulo="Vagas abertas por área">
            <div className="w-full space-y-1">
              <Alvo id="area"><div className="flex items-center gap-1"><span className="w-16 truncate">Tecnologia</span><span className="h-2 w-2/3 rounded bg-marinho-700" /></div></Alvo>
              <div className="flex items-center gap-1"><span className="w-16 truncate">Marketing</span><span className="h-2 w-1/3 rounded bg-marinho-700/60" /></div>
              <div className="flex items-center gap-1"><span className="w-16 truncate">Saúde</span><span className="h-2 w-1/4 rounded bg-marinho-700/40" /></div>
            </div>
          </Cartao>
        </>
      ),
    },
    {
      legenda: "Em “Estudantes por curso”, clique num curso para abrir a lista dos estudantes dele. Para guardar a visão, use “Imprimir / PDF”.",
      alvo: "curso",
      tela: (
        <>
          <Barra><Botao id="imprimir">Imprimir / PDF</Botao></Barra>
          <Cartao titulo="Estudantes por curso">
            <div className="w-full space-y-1">
              <Alvo id="curso"><p className="flex justify-between"><span>Administração</span><b>14</b></p></Alvo>
              <p className="flex justify-between"><span>Marketing</span><b>9</b></p>
              <p className="flex justify-between"><span>Direito</span><b>7</b></p>
            </div>
          </Cartao>
        </>
      ),
    },
  ],

  vagas: [
    { legenda: "Para abrir uma vaga, clique em Novo cadastro e escolha Vaga.", alvo: "tipo", tela: <NovoCadastro tipo="Vaga" /> },
    {
      legenda: "Escolha a empresa e preencha Nº, título, descrição e bolsa-auxílio. Prazo, quantidade e responsável são opcionais.",
      alvo: "prazo",
      tela: <Janela titulo="Adicionar vaga"><Campo rotulo="Empresa" valor="Loja Exemplo" /><Campo rotulo="Título" valor="Estágio em Marketing" /><Campo id="prazo" rotulo="Prazo (opcional)" valor="20/11/2026" /></Janela>,
    },
    {
      legenda: "Use as abas de status e “Minhas vagas” para ver só o que interessa. “Agrupar por empresa” organiza a lista.",
      alvo: "minhas",
      tela: (
        <>
          <Barra><Botao primario>Abertas</Botao><Botao>Suspensas</Botao><Botao>Fechadas</Botao><Botao>Todas</Botao></Barra>
          <Barra><Botao id="minhas">Minhas vagas</Botao><Botao>Agrupar por empresa</Botao><Botao>Exportar CSV</Botao></Barra>
          <Cartao titulo="Nº 12345 · Estágio em Marketing" sub="Loja Exemplo"><Selo tom="ambar">Vaga parada</Selo><Selo tom="rosa">Prazo em 2 dias</Selo><Selo>1 de 2 contratados</Selo></Cartao>
        </>
      ),
    },
    {
      legenda: "Para trabalhar com os candidatos de uma vaga, clique em Abrir Kanban.",
      alvo: "kanban",
      tela: <Lista><Cartao titulo="Nº 12345 · Estágio em Marketing" sub="Loja Exemplo · 5 em processo" direita={Tres}><Botao id="kanban" primario>Abrir Kanban</Botao></Cartao></Lista>,
    },
  ],

  kanban: [
    { legenda: "Cada coluna é uma etapa. Arraste o cartão para outra coluna para registrar o andamento.", alvo: "ana", tela: <Quadro /> },
    { legenda: "Pronto: Ana foi para Enviado à Empresa. Arrastar dentro da mesma coluna define a prioridade.", alvo: "ana", tela: <Quadro anaEm="Enviado à Empresa" /> },
    {
      legenda: "Em Entrevista pede data e hora. Se fechar sem salvar, o cartão volta para onde estava.",
      alvo: "data",
      tela: <Janela titulo="Agendar entrevista"><Campo id="data" rotulo="Data e hora" valor="04/11/2026 09:30" /><Campo rotulo="Formato" valor="Presencial" /><Campo rotulo="Local ou link (opcional)" valor="Av. Exemplo, 100" /></Janela>,
    },
    {
      legenda: "Dispensado pede o motivo: toque numa sugestão ou escreva o seu.",
      alvo: "motivo",
      tela: <Janela titulo="Dispensar candidato"><Alvo id="motivo" className="inline-block"><Selo tom="ambar">Outra proposta</Selo></Alvo> <Selo>Distância</Selo> <Selo>Horário</Selo><Campo rotulo="Motivo" valor="Aceitou outra proposta" /></Janela>,
    },
    {
      legenda: "Ao marcar Contratado, o painel pergunta se você quer encerrar a vaga ou mantê-la aberta.",
      alvo: "encerrar",
      tela: <Janela titulo="Candidato contratado!"><p>Deseja encerrar a vaga?</p><div className="flex gap-1"><Botao id="encerrar" primario>Encerrar vaga</Botao><Botao>Manter aberta</Botao></div></Janela>,
    },
    { legenda: "Selecionar permite mover vários cartões de uma vez ou dispensar todos com o mesmo motivo.", alvo: "selecionar", tela: <Quadro /> },
    { legenda: "Sugerir candidatos mostra estudantes compatíveis com a vaga que ainda não estão no quadro.", alvo: "sugerir", tela: <Quadro /> },
  ],

  calendario: [
    { legenda: "As entrevistas marcadas no Kanban aparecem aqui sozinhas. Clique em uma para ver os detalhes.", alvo: "entrevista", tela: <Calendario /> },
    { legenda: "Peça a confirmação pelo WhatsApp, com a mensagem pronta. Quando o candidato responder, clique em Confirmar.", alvo: "whats", tela: <PainelEntrevista /> },
    { legenda: "Depois do horário, registre o resultado. Realizada leva o candidato para Em Teste.", alvo: "realizada", tela: <PainelEntrevista /> },
    { legenda: "Mudou a data? Use Reagendar. O painel oferece reenviar o convite, se você mandou lembrete por e-mail.", alvo: "reagendar", tela: <PainelEntrevista /> },
    { legenda: "Para reuniões e visitas, use Novo evento ou clique num horário vazio nas visões Dia e Semana.", alvo: "evento", tela: <Calendario /> },
  ],

  empresas: [
    { legenda: "Para cadastrar, clique em Novo cadastro e escolha Empresa. Toda vaga pertence a uma empresa.", alvo: "tipo", tela: <NovoCadastro tipo="Empresa" /> },
    { legenda: "O menu “⋯” de cada empresa guarda as outras ações.", alvo: "menu", tela: <ListaEmpresas /> },
    {
      legenda: "Nele você vê as vagas da empresa, registra contatos, abre o relatório, edita ou exclui.",
      alvo: "contatos",
      tela: <Menu itens={[[undefined, "Ver vagas da empresa"], ["contatos", "Contatos e anotações"], [undefined, "Relatório da empresa"], [undefined, "Editar"], [undefined, "Excluir"]]} />,
    },
    { legenda: "Com um Próximo contato preenchido, no dia combinado chega um aviso no sino.", alvo: "proximo", tela: <RegistroContato quem="Loja Exemplo" /> },
  ],

  empresasSemVaga: [
    {
      legenda: "Aqui ficam as empresas sem nenhuma vaga aberta, com a última vaga de cada uma. Use a lista para prospectar.",
      alvo: "empresa",
      tela: (
        <Lista>
          <Cartao id="empresa" titulo="Clínica Modelo" sub="Última vaga: Estágio em Administração · Fechada" direita={Tres} />
          <Cartao titulo="Padaria Central" sub="Nunca teve vaga cadastrada" direita={Tres} />
        </Lista>
      ),
    },
    { legenda: "Depois de ligar, abra o menu “⋯”, registre o contato e marque o Próximo contato.", alvo: "proximo", tela: <RegistroContato quem="Clínica Modelo" /> },
    {
      legenda: "No dia marcado, o aviso aparece no sino. Depois de falar com a empresa, clique em “Marcar retorno como feito”.",
      alvo: "feito",
      tela: (
        <>
          <Barra><Bell size={15} className="text-marinho-800" /><Selo tom="ambar">Retornar contato: Clínica Modelo</Selo></Barra>
          <Cartao titulo="Ligação · 03/11" sub="Pediu retorno sobre nova vaga"><Botao id="feito">Marcar retorno como feito</Botao></Cartao>
        </>
      ),
    },
  ],

  estudantes: [
    { legenda: "Para cadastrar, clique em Novo cadastro e escolha Estudante.", alvo: "tipo", tela: <NovoCadastro tipo="Estudante" /> },
    {
      legenda: "Nome, telefone com DDD e curso bastam. Sem vaga agora? Escolha “Sem vaga — indicar depois”.",
      alvo: "vaga",
      tela: <Janela titulo="Adicionar estudante"><Campo rotulo="Nome" valor="Ana Souza" /><Campo rotulo="Telefone" valor="(31) 90000-1234" /><Campo rotulo="Curso" valor="Marketing" /><Campo id="vaga" rotulo="Vaga" valor="Sem vaga — indicar depois" /></Janela>,
    },
    { legenda: "Busque por nome, curso ou final do telefone, como 1234. Os filtros refinam por curso, turno, cidade e mais.", alvo: "busca", tela: <ListaEstudantes busca="1234" /> },
    { legenda: "Clique no estudante para abrir o perfil, com histórico, currículo e vagas compatíveis.", alvo: "estudante", tela: <ListaEstudantes /> },
  ],

  perfil: [
    {
      legenda: "Em Vagas compatíveis estão as vagas abertas que combinam com o curso. Use “Indicar para vaga” para inscrever o estudante.",
      alvo: "indicar",
      tela: (
        <>
          <Cartao titulo="Ana Souza" sub="Marketing · Belo Horizonte" />
          <p className="mb-1 mt-2 font-bold text-marinho-900">Vagas compatíveis</p>
          <Cartao titulo="Nº 12345 · Estágio em Marketing" sub="Loja Exemplo"><Selo tom="verde">Curso</Selo><Botao id="indicar" primario>Indicar para vaga</Botao></Cartao>
        </>
      ),
    },
    {
      legenda: "A Linha do tempo mostra por quais etapas o estudante passou em cada vaga, com data e quem fez.",
      alvo: "linha",
      tela: (
        <Alvo id="linha">
          <Cartao titulo="Linha do tempo">
            <div className="w-full space-y-1 border-l-2 border-ambar-400 pl-2">
              <p>03/11 · Movido para Em Teste, por Marina</p>
              <p>28/10 · Movido para Enviado à Empresa</p>
              <p>25/10 · Candidatura criada</p>
            </div>
          </Cartao>
        </Alvo>
      ),
    },
    { legenda: "Em Contatos e anotações, registre as conversas e combine a data do próximo contato.", alvo: "proximo", tela: <RegistroContato quem="Ana Souza" /> },
    {
      legenda: "“Mensagem com modelo” preenche nome, vaga e data sozinha. É só copiar e colar no WhatsApp ou no e-mail.",
      alvo: "copiar",
      tela: <Janela titulo="Mensagem com modelo"><Campo rotulo="Modelo" valor="Confirmação de entrevista" /><p className="rounded bg-slate-50 p-1.5">Olá, Ana! Sua entrevista para Estágio em Marketing é em 04/11 às 09:30.</p><Botao id="copiar" primario>Copiar</Botao></Janela>,
    },
  ],

  bancoTalentos: [
    {
      legenda: "Aqui estão os estudantes dispensados de alguma vaga e ainda não contratados. Busque por nome ou filtre por curso.",
      alvo: "busca",
      tela: (
        <>
          <Barra><Busca texto="Buscar por nome" /><Botao>Curso</Botao></Barra>
          <Cartao titulo="Bruno Lima" sub="Administração · Dispensado da Clínica Modelo em 20/10"><span className="text-[10px] text-slate-600">Motivo: horário incompatível</span></Cartao>
        </>
      ),
    },
    {
      legenda: "A etiqueta Em processo avisa que a pessoa já participa de outra seleção. Abrir WhatsApp chama direto.",
      alvo: "processo",
      tela: <Cartao titulo="Carla Mendes" sub="Direito · Dispensada do Escritório Silva"><Alvo id="processo" className="inline-block"><Selo tom="ambar">Em processo</Selo></Alvo><Botao>Abrir WhatsApp</Botao></Cartao>,
    },
    {
      legenda: "Clique em “Indicar para vaga” e escolha uma vaga aberta. A pessoa entra no Kanban como Candidato Contatado.",
      alvo: "indicar",
      tela: <Cartao titulo="Bruno Lima" sub="Administração"><Botao id="indicar" primario>Indicar para vaga</Botao></Cartao>,
    },
  ],

  contratacoes: [
    {
      legenda: "Aqui estão todos os contratados, com a data e quantos dias levou. Filtre por período e por empresa.",
      alvo: "periodo",
      tela: (
        <>
          <Barra><Botao id="periodo">Este mês</Botao><Botao>Este ano</Botao><Botao>Exportar CSV</Botao></Barra>
          <Cartao titulo="Ana Souza" sub="Estágio em Marketing · Loja Exemplo · 03/11"><Selo tom="verde">12 dias após a candidatura</Selo></Cartao>
        </>
      ),
    },
    {
      legenda: "Em “Dados do estágio”, preencha o que tiver: início, fim do contrato, TCE, seguro, supervisor e taxa. Nada é obrigatório.",
      alvo: "fim",
      tela: <Janela titulo="Dados do estágio"><Campo rotulo="Início" valor="10/11/2026" /><Campo id="fim" rotulo="Fim do contrato" valor="10/11/2027" /><Campo rotulo="Supervisor" valor="Marina Dias" /></Janela>,
    },
    {
      legenda: "O painel avisa sobre contrato terminando, limite de 2 anos, TCE e relatório. O filtro “Pendências do estágio” junta todos.",
      alvo: "pendencias",
      tela: (
        <>
          <Barra><Botao id="pendencias">Pendências do estágio</Botao></Barra>
          <Cartao titulo="Ana Souza" sub="Loja Exemplo"><Selo tom="rosa">TCE ainda não assinado</Selo><Selo tom="ambar">Contrato termina em 18 dias</Selo></Cartao>
        </>
      ),
    },
  ],

  configuracoes: [
    {
      legenda: "A aba Geral tem a meta mensal de contratações, que aparece no Dashboard. Só quem administra pode alterar.",
      alvo: "geral",
      tela: (
        <>
          <Barra><Botao id="geral" primario>Geral</Botao><Botao>Modelos de mensagem</Botao><Botao>Celular</Botao></Barra>
          <Cartao titulo="Meta mensal de contratações" sub="10 por mês" />
        </>
      ),
    },
    {
      legenda: "Em Modelos de mensagem, crie textos prontos. Clique numa variável para inseri-la no texto.",
      alvo: "variavel",
      tela: (
        <>
          <Barra><Botao>Geral</Botao><Botao primario>Modelos de mensagem</Botao><Botao>Celular</Botao></Barra>
          <Cartao titulo="Confirmação de entrevista" sub="Olá, {primeiro_nome}! Sua entrevista é em {data_entrevista}."><Alvo id="variavel" className="inline-block"><Selo tom="azul">{"{primeiro_nome}"}</Selo></Alvo><Selo>{"{vaga}"}</Selo><Selo>{"{empresa}"}</Selo></Cartao>
        </>
      ),
    },
    {
      legenda: "Em Celular, conecte o seu Telegram para receber avisos e conversar com o bot. Cada pessoa conecta o próprio.",
      alvo: "telegram",
      tela: (
        <>
          <Barra><Botao>Geral</Botao><Botao>Modelos de mensagem</Botao><Botao primario>Celular</Botao></Barra>
          <Cartao titulo="Avisos no celular pelo Telegram"><Botao id="telegram" primario>Conectar Telegram</Botao></Cartao>
        </>
      ),
    },
    {
      legenda: "Quem administra vê também Usuários, para criar e desativar acessos, e Atividades, com quem alterou o quê e quando.",
      alvo: "usuarios",
      tela: (
        <>
          <Barra><Botao>Celular</Botao><Botao id="usuarios" primario>Usuários</Botao><Botao>Atividades</Botao></Barra>
          <Cartao titulo="Marina Dias" sub="marina@exemplo.com"><Selo tom="azul">Administrador</Selo></Cartao>
        </>
      ),
    },
  ],

  relatorio: [
    {
      legenda: "Este é o resumo da empresa, com as vagas e as contratações. Você chega aqui pelo menu “⋯” em Empresas.",
      tela: (
        <>
          <Cartao titulo="Loja Exemplo" sub="Relatório da empresa" />
          <div className="mt-1.5 grid grid-cols-2 gap-1.5"><Cartao titulo="3" sub="Vagas" /><Cartao titulo="2" sub="Contratações" /></div>
        </>
      ),
    },
    {
      legenda: "Clique em “Imprimir / PDF” para imprimir ou salvar um arquivo e enviar ao cliente.",
      alvo: "imprimir",
      tela: <><Barra><Botao id="imprimir" primario>Imprimir / PDF</Botao></Barra><Cartao titulo="Loja Exemplo" sub="Relatório da empresa" /></>,
    },
  ],
};
