// Dicionário de áreas: liga o curso do estudante à área das vagas. Editável à mão.
//
// Cada área tem:
//   id         identificador fixo (é o que fica gravado em Vaga.area_manual; não renomeie)
//   nome       como aparece nas telas
//   cursos     nomes e abreviações de curso que pertencem à área
//   palavras   palavras e expressões que, no título, na descrição ou no setor da empresa, indicam a área da vaga
//   correlatas ids das áreas próximas (a correlação vale nos dois sentidos: basta escrever de um lado)
//   reserva    (opcional) só vale para o curso quando nenhuma outra área bate (ex.: "técnico" genérico)
//
// Como escrever: sem acento e em minúsculas ("administracao"), uma palavra ou expressão por item. A comparação
// ignora maiúsculas, acentos, pontuação e espaços extras, e só aceita palavras inteiras: "ti" não acha "time",
// "direito" não acha "direitos". Plural e feminino precisam ser escritos ("advogado", "advogada").

const AREAS = [
  {
    id: "tecnologia",
    nome: "Tecnologia",
    cursos: [
      "engenharia de software", "eng software", "software", "ciencia da computacao", "ciencias da computacao", "computacao",
      "engenharia de computacao", "engenharia da computacao", "sistemas de informacao", "analise e desenvolvimento de sistemas",
      "ads", "tads", "desenvolvimento de sistemas", "sistemas para internet", "tecnologia da informacao", "gestao da tecnologia da informacao",
      "ti", "informatica", "tecnico em informatica", "redes de computadores", "seguranca da informacao", "ciencia de dados",
      "banco de dados", "jogos digitais", "inteligencia artificial", "engenharia de dados",
    ],
    palavras: [
      "tecnologia", "tecnologia da informacao", "ti", "informatica", "computacao", "software", "desenvolvedor", "desenvolvedora",
      "programador", "programadora", "programacao", "desenvolvimento de software", "desenvolvimento de sistemas",
      "desenvolvimento web", "web", "front end", "frontend", "back end", "backend", "full stack", "fullstack", "javascript",
      "typescript", "python", "java", "php", "sql", "react", "node", "banco de dados", "ciencia de dados", "analise de dados",
      "engenharia de dados", "dados e bi", "power bi", "suporte tecnico", "suporte de ti", "help desk", "helpdesk", "service desk",
      "infraestrutura de ti", "redes de computadores", "seguranca da informacao", "devops", "cloud", "analista de sistemas",
      "sistemas de informacao", "testes de software", "qa", "ia", "inteligencia artificial", "machine learning",
      "aprendizado de maquina",
    ],
    correlatas: [],
  },
  {
    id: "engenharia_civil",
    nome: "Engenharia Civil",
    cursos: ["engenharia civil", "eng civil", "edificacoes", "tecnico em edificacoes", "construcao civil"],
    palavras: [
      "engenharia civil", "engenheiro civil", "engenheira civil", "obra", "obras", "construcao civil", "canteiro de obras",
      "edificacoes", "orcamento de obras", "topografia", "construtora", "incorporadora",
    ],
    correlatas: ["engenharia_ambiental"],
  },
  {
    id: "engenharia_eletrica",
    nome: "Engenharia Elétrica",
    cursos: [
      "engenharia eletrica", "eng eletrica", "eletrotecnica", "tecnico em eletrotecnica", "eletronica", "engenharia eletronica",
      "engenharia de controle e automacao", "automacao industrial",
    ],
    palavras: [
      "engenharia eletrica", "engenheiro eletricista", "eletrica", "eletrotecnica", "eletronica", "instalacoes eletricas",
      "projetos eletricos", "automacao industrial", "subestacao", "subestacoes", "energia solar", "fotovoltaico", "fotovoltaica",
    ],
    correlatas: ["engenharia_mecanica"],
  },
  {
    id: "engenharia_mecanica",
    nome: "Engenharia Mecânica",
    cursos: ["engenharia mecanica", "eng mecanica", "mecanica", "tecnico em mecanica", "mecatronica", "engenharia mecatronica"],
    palavras: [
      "engenharia mecanica", "engenheiro mecanico", "mecanica", "mecatronica", "manutencao industrial", "manutencao mecanica",
      "usinagem", "solidworks", "caldeiraria", "projetos mecanicos",
    ],
    correlatas: ["engenharia_producao"],
  },
  {
    id: "engenharia_producao",
    nome: "Engenharia de Produção",
    cursos: ["engenharia de producao", "eng producao", "engenharia de producao mecanica"],
    palavras: [
      "engenharia de producao", "engenheiro de producao", "pcp", "planejamento e controle da producao", "processos produtivos",
      "linha de producao", "chao de fabrica", "melhoria continua", "lean manufacturing", "controle de qualidade",
    ],
    correlatas: ["administracao", "logistica"],
  },
  {
    id: "engenharia_quimica",
    nome: "Engenharia Química",
    cursos: ["engenharia quimica", "eng quimica", "quimica", "tecnico em quimica", "quimica industrial"],
    palavras: ["engenharia quimica", "engenheiro quimico", "quimica", "laboratorio quimico", "analises quimicas", "processos quimicos"],
    correlatas: ["engenharia_ambiental"],
  },
  {
    id: "engenharia_ambiental",
    nome: "Engenharia Ambiental",
    cursos: ["engenharia ambiental", "eng ambiental", "gestao ambiental", "engenharia sanitaria", "meio ambiente", "tecnico em meio ambiente"],
    palavras: [
      "engenharia ambiental", "engenheiro ambiental", "meio ambiente", "ambiental", "licenciamento ambiental", "sustentabilidade",
      "residuos", "saneamento",
    ],
    correlatas: [],
  },
  {
    id: "juridico",
    nome: "Jurídico",
    cursos: ["direito", "ciencias juridicas", "servicos juridicos", "tecnico em servicos juridicos"],
    palavras: [
      "direito", "juridico", "juridica", "advocacia", "advogado", "advogada", "escritorio de advocacia", "oab", "processual",
      "processos judiciais", "peticao", "peticoes", "audiencia", "audiencias", "forense", "tribunal", "contencioso",
      // Expressões longas vencem as curtas: "direito administrativo" não conta como "administrativo".
      "direito administrativo", "direito tributario", "direito do trabalho", "direito trabalhista", "direito empresarial",
    ],
    correlatas: [],
  },
  {
    id: "administracao",
    nome: "Administração e Gestão",
    cursos: [
      "administracao", "adm", "administracao de empresas", "administracao publica", "gestao empresarial", "gestao comercial",
      "gestao publica", "gestao de negocios", "processos gerenciais", "comercio exterior", "tecnico em administracao",
    ],
    palavras: [
      "administracao", "administrador", "administradora", "gestao empresarial", "processos gerenciais", "planejamento estrategico",
      "consultoria empresarial", "comercio exterior", "gestao de processos", "analista de processos",
    ],
    correlatas: ["contabil", "rh", "logistica", "atendimento"],
  },
  {
    id: "contabil",
    nome: "Contábil e Financeiro",
    cursos: [
      "ciencias contabeis", "contabeis", "contabilidade", "tecnico em contabilidade", "economia", "ciencias economicas",
      "gestao financeira", "financas", "ciencias atuariais",
    ],
    palavras: [
      "contabil", "contabilidade", "contabeis", "fiscal", "tributario", "tributaria", "financeiro", "financeira", "financas",
      "contas a pagar", "contas a receber", "faturamento", "tesouraria", "controladoria", "auditoria", "economia", "economista",
      "conciliacao bancaria", "escritorio contabil",
    ],
    correlatas: [],
  },
  {
    id: "rh",
    nome: "Recursos Humanos",
    cursos: ["recursos humanos", "gestao de recursos humanos", "rh", "gestao de pessoas"],
    palavras: [
      "recursos humanos", "rh", "departamento pessoal", "recrutamento", "recrutamento e selecao", "folha de pagamento",
      "gestao de pessoas", "treinamento e desenvolvimento", "admissao e demissao", "dho",
    ],
    correlatas: ["psicologia"],
  },
  {
    id: "logistica",
    nome: "Logística",
    cursos: ["logistica", "gestao logistica", "tecnico em logistica"],
    palavras: [
      "logistica", "estoque", "almoxarifado", "expedicao", "armazem", "suprimentos", "cadeia de suprimentos", "supply chain",
      "inventario", "compras", "recebimento de mercadorias",
    ],
    correlatas: [],
  },
  {
    id: "marketing",
    nome: "Marketing e Comunicação",
    cursos: [
      "marketing", "publicidade", "publicidade e propaganda", "propaganda", "comunicacao social", "comunicacao", "jornalismo",
      "relacoes publicas", "producao audiovisual", "producao multimidia", "cinema", "radio e tv", "radio tv e internet",
    ],
    palavras: [
      "marketing", "marketing digital", "publicidade", "propaganda", "comunicacao", "jornalismo", "jornalista", "redes sociais",
      "midias sociais", "social media", "criacao de conteudo", "producao de conteudo", "assessoria de imprensa",
      "relacoes publicas", "branding", "copywriting", "redacao publicitaria", "endomarketing", "audiovisual", "trafego pago",
    ],
    correlatas: ["design"],
  },
  {
    id: "design",
    nome: "Arquitetura e Design",
    cursos: [
      "arquitetura", "arquitetura e urbanismo", "urbanismo", "design", "design grafico", "design de interiores", "design de produto",
      "design de moda", "moda", "design digital", "tecnico em design de interiores",
    ],
    palavras: [
      "arquitetura", "arquiteto", "arquiteta", "urbanismo", "escritorio de arquitetura", "projeto arquitetonico", "design",
      "designer", "design grafico", "designer grafico", "design de interiores", "interiores", "autocad", "revit", "sketchup",
      "photoshop", "illustrator", "ux", "ui", "moda",
    ],
    correlatas: [],
  },
  {
    id: "saude",
    nome: "Saúde",
    cursos: [
      "enfermagem", "tecnico em enfermagem", "odontologia", "farmacia", "fisioterapia", "nutricao", "biomedicina", "medicina",
      "fonoaudiologia", "radiologia", "educacao fisica", "terapia ocupacional", "estetica", "estetica e cosmetica",
      "medicina veterinaria", "veterinaria", "analises clinicas", "gestao hospitalar", "saude",
    ],
    palavras: [
      "saude", "enfermagem", "enfermeiro", "enfermeira", "hospital", "hospitalar", "clinica", "clinicas", "odontologia",
      "odontologico", "odontologica", "consultorio", "farmacia", "farmaceutico", "farmaceutica", "drogaria", "fisioterapia",
      "fisioterapeuta", "nutricao", "nutricionista", "biomedicina", "analises clinicas", "laboratorio de analises clinicas",
      "medicina", "medico", "medica", "radiologia", "fonoaudiologia", "veterinaria", "veterinario", "academia", "educacao fisica",
      "estetica", "pacientes",
    ],
    correlatas: [],
  },
  {
    id: "psicologia",
    nome: "Psicologia",
    cursos: ["psicologia"],
    palavras: ["psicologia", "psicologo", "psicologa", "psicologico", "psicologica", "avaliacao psicologica", "psicologia organizacional"],
    correlatas: [],
  },
  {
    id: "educacao",
    nome: "Educação e Pedagogia",
    cursos: [
      "pedagogia", "licenciatura", "letras", "historia", "geografia", "matematica", "normal superior", "educacao",
      "psicopedagogia", "ciencias biologicas", "biologia", "fisica",
    ],
    palavras: [
      "pedagogia", "pedagogico", "pedagogica", "educacao", "educacional", "educacao infantil", "ensino fundamental", "escola",
      "escolar", "professor", "professora", "auxiliar de classe", "sala de aula", "alfabetizacao", "docencia", "psicopedagogia",
      "reforco escolar", "creche",
    ],
    correlatas: [],
  },
  {
    id: "atendimento",
    nome: "Atendimento e Administrativo Geral",
    cursos: ["secretariado", "secretariado executivo", "tecnico em secretariado"],
    palavras: [
      "recepcao", "recepcionista", "atendimento ao cliente", "atendimento ao publico", "atendente", "sac", "telemarketing",
      "televendas", "vendas", "vendedor", "vendedora", "administrativo", "administrativa", "auxiliar administrativo",
      "assistente administrativo", "rotinas administrativas", "secretaria", "secretariado", "escritorio",
    ],
    correlatas: ["ensino_medio"],
  },
  {
    id: "ensino_medio",
    nome: "Ensino Médio e Técnico",
    cursos: ["ensino medio", "medio", "ensino medio tecnico", "tecnico", "curso tecnico", "jovem aprendiz", "aprendiz"],
    palavras: [
      "ensino medio", "nivel medio", "cursando ensino medio", "jovem aprendiz", "menor aprendiz", "aprendiz", "curso tecnico",
      "nivel tecnico", "ensino tecnico",
    ],
    correlatas: [],
    // "Técnico em Enfermagem" é Saúde; só "técnico" sem área (ou "ensino médio") cai aqui.
    reserva: true,
  },
];

// Trechos apagados do texto da vaga antes da busca, porque usam uma palavra-chave com outro sentido
// (benefícios e expressões comuns em qualquer anúncio).
const IGNORAR = [
  "arquitetura de software", "arquitetura de sistemas", "arquitetura de dados", "arquitetura de solucoes",
  "tem direito", "tera direito", "direito a vale", "direito ao vale", "direito a beneficios", "direito aos beneficios",
  "direito a ferias", "direito a recesso", "direito ao recesso",
  "plano de saude", "plano odontologico", "assistencia medica", "assistencia odontologica", "convenio medico",
  "mao de obra",
];

module.exports = { AREAS, IGNORAR };
