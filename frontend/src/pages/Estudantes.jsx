import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Send, SlidersHorizontal, Trash2, UserRound, X } from "lucide-react";
import CandidaturaHistory from "../components/CandidaturaHistory.jsx";
import EntityList from "../components/EntityList.jsx";
import { IndicateDialog } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import { kanbanStatusLabels } from "../kanbanStatus.js";
import { courseOptions, formatPhone, normalize } from "../text.js";
import { availabilityText, formatDate, formatMonthYear, periodoLabels, studyShift, studyShiftLabel, turnoEstudoLabels } from "../estudante.js";
import { situationLabels, studentSituation } from "../perfil.js";

const EMPTY_FILTERS = { curso: "", instituicao: "", turno: "", semestreMinimo: "", situacao: "", disponibilidade: [] };

const situationStyles = {
  EM_PROCESSO: "bg-sky-50 text-sky-800",
  CONTRATADO: "bg-emerald-50 text-emerald-800",
};

const csvExport = {
  filename: "estudantes",
  columns: [
    { header: "Nome", value: (estudante) => estudante.nome_completo },
    { header: "Situação", value: (estudante) => situationLabels[studentSituation(estudante)] },
    { header: "Curso", value: (estudante) => estudante.curso },
    { header: "Instituição de ensino", value: (estudante) => estudante.instituicao_ensino },
    { header: "Telefone", value: (estudante) => formatPhone(estudante.telefone) },
    { header: "E-mail", value: (estudante) => estudante.email },
    { header: "Turno de estudo", value: (estudante) => studyShiftLabel(estudante) },
    { header: "Disponibilidade", value: (estudante) => availabilityText(estudante.disponibilidade) },
    { header: "Semestre atual", value: (estudante) => estudante.semestre_atual },
    { header: "Previsão de formatura", value: (estudante) => formatMonthYear(estudante.previsao_formatura) },
    { header: "Data de nascimento", value: (estudante) => formatDate(estudante.data_nascimento) },
    { header: "Endereço", value: (estudante) => estudante.endereco },
    { header: "Currículo", value: (estudante) => estudante.link_curriculo },
    { header: "Candidaturas", value: (estudante) => estudante.aplicacoes?.length ?? 0 },
    {
      header: "Vagas e etapas",
      value: (estudante) =>
        (estudante.aplicacoes ?? [])
          .map((aplicacao) => `${aplicacao.vaga?.titulo ?? "Vaga"}: ${kanbanStatusLabels[aplicacao.status_kanban]}`)
          .join(" | "),
    },
    { header: "Anotações do recrutador", value: (estudante) => estudante.anotacoes_recrutador },
  ],
};

const getSearchText = (estudante) => `${estudante.nome_completo} ${estudante.curso} ${estudante.instituicao_ensino}`;
const getName = (estudante) => estudante.nome_completo;
const renderEditExtra = (estudante) => <CandidaturaHistory aplicacoes={estudante.aplicacoes} />;

// Todos os filtros ativos precisam bater ao mesmo tempo. Disponibilidade: precisa estar livre em todos os períodos marcados.
function matchesFilters(estudante, filters) {
  if (filters.curso && normalize(estudante.curso) !== filters.curso) return false;
  if (filters.instituicao && normalize(estudante.instituicao_ensino) !== filters.instituicao) return false;
  if (filters.turno && studyShift(estudante) !== filters.turno) return false;
  if (filters.semestreMinimo && !(estudante.semestre_atual >= Number(filters.semestreMinimo))) return false;
  if (filters.situacao && studentSituation(estudante) !== filters.situacao) return false;
  if (filters.disponibilidade.length && !filters.disponibilidade.every((periodo) => estudante.disponibilidade?.includes(periodo))) return false;
  return true;
}

// Card do estudante; o nome abre o perfil.
function renderEstudante(estudante) {
  const situation = studentSituation(estudante);
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5 pr-10">
        {situation !== "DISPONIVEL" && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${situationStyles[situation]}`}>{situationLabels[situation]}</span>
        )}
        {studyShiftLabel(estudante) && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" title="Turno de estudo">
            {studyShiftLabel(estudante)}
          </span>
        )}
        {estudante.semestre_atual && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{estudante.semestre_atual}º semestre</span>
        )}
      </div>
      <h2 className="pr-10 text-lg font-semibold leading-6">
        <Link
          to={`/estudantes/${estudante.id}`}
          title="Ver perfil"
          className="text-left text-marinho-900 underline-offset-2 hover:text-marinho-600 hover:underline"
        >
          {estudante.nome_completo}
        </Link>
      </h2>
      <p className="mt-2 text-sm text-slate-600">{estudante.curso}</p>
      <p className="text-sm text-slate-500">{estudante.instituicao_ensino}</p>
      {(estudante.disponibilidade?.length > 0 || estudante.previsao_formatura) && (
        <p className="mt-2 text-xs text-slate-500">
          {estudante.disponibilidade?.length > 0 && (
            <>
              Disponível: <span className="font-semibold text-slate-700">{availabilityText(estudante.disponibilidade)}</span>
            </>
          )}
          {estudante.disponibilidade?.length > 0 && estudante.previsao_formatura && " · "}
          {estudante.previsao_formatura && (
            <>
              Forma em <span className="font-semibold text-slate-700">{formatMonthYear(estudante.previsao_formatura)}</span>
            </>
          )}
        </p>
      )}
      {estudante.anotacoes_recrutador && (
        <p className="mt-3 line-clamp-2 border-l-2 border-ambar-300 pl-2 text-sm italic text-slate-600">{estudante.anotacoes_recrutador}</p>
      )}
      <p className="mt-auto pt-6 text-sm text-slate-500">
        {estudante.aplicacoes?.length ?? 0} {estudante.aplicacoes?.length === 1 ? "candidatura" : "candidaturas"}
      </p>
    </>
  );
}

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40";

function FilterSelect({ id, label, value, onChange, children }) {
  return (
    <label htmlFor={id} className="block min-w-0 space-y-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
    </label>
  );
}

function Filters({ filters, onChange, students, visibleCount, isLoading }) {
  // No celular os filtros começam recolhidos (as etiquetas dos ativos continuam visíveis).
  const [isOpen, setIsOpen] = useState(() => !window.matchMedia?.("(max-width: 639px)").matches);
  const courses = useMemo(() => courseOptions(students.map((student) => student.curso)), [students]);
  const institutions = useMemo(() => courseOptions(students.map((student) => student.instituicao_ensino)), [students]);
  const set = (name) => (value) => onChange({ ...filters, [name]: value });
  const toggleAvailability = (periodo) =>
    onChange({
      ...filters,
      disponibilidade: filters.disponibilidade.includes(periodo)
        ? filters.disponibilidade.filter((item) => item !== periodo)
        : [...filters.disponibilidade, periodo],
    });

  const chips = [
    filters.curso && { key: "curso", label: `Curso: ${courses.find((c) => c.key === filters.curso)?.label ?? filters.curso}`, clear: { curso: "" } },
    filters.instituicao && {
      key: "instituicao",
      label: `Instituição: ${institutions.find((i) => i.key === filters.instituicao)?.label ?? filters.instituicao}`,
      clear: { instituicao: "" },
    },
    filters.turno && { key: "turno", label: `Estuda: ${turnoEstudoLabels[filters.turno]}`, clear: { turno: "" } },
    filters.semestreMinimo && { key: "semestre", label: `A partir do ${filters.semestreMinimo}º semestre`, clear: { semestreMinimo: "" } },
    filters.situacao && { key: "situacao", label: situationLabels[filters.situacao], clear: { situacao: "" } },
    ...filters.disponibilidade.map((periodo) => ({
      key: `disp-${periodo}`,
      label: `Disponível: ${periodoLabels[periodo]}`,
      clear: { disponibilidade: filters.disponibilidade.filter((item) => item !== periodo) },
    })),
  ].filter(Boolean);

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg text-slate-700">
          <strong className="text-2xl font-extrabold text-marinho-900">{isLoading ? "…" : visibleCount}</strong>{" "}
          {visibleCount === 1 ? "estudante" : "estudantes"}
          {!isLoading && chips.length > 0 && <span className="text-sm text-slate-500"> de {students.length}</span>}
        </p>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-marinho-700 hover:bg-marinho-50"
        >
          <SlidersHorizontal size={16} /> {isOpen ? "Esconder filtros" : `Filtros${chips.length ? ` (${chips.length})` : ""}`}
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3 lg:grid-cols-6 sm:p-4">
          <FilterSelect id="filtro-curso" label="Curso" value={filters.curso} onChange={set("curso")}>
            <option value="">Todos</option>
            {courses.map((course) => <option key={course.key} value={course.key}>{course.label}</option>)}
          </FilterSelect>
          <FilterSelect id="filtro-instituicao" label="Instituição" value={filters.instituicao} onChange={set("instituicao")}>
            <option value="">Todas</option>
            {institutions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </FilterSelect>
          <FilterSelect id="filtro-turno" label="Turno de estudo" value={filters.turno} onChange={set("turno")}>
            <option value="">Todos</option>
            {Object.entries(turnoEstudoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FilterSelect>
          <FilterSelect id="filtro-semestre" label="Semestre mínimo" value={filters.semestreMinimo} onChange={set("semestreMinimo")}>
            <option value="">Qualquer</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((semester) => (
              <option key={semester} value={semester}>A partir do {semester}º</option>
            ))}
          </FilterSelect>
          <FilterSelect id="filtro-situacao" label="Situação" value={filters.situacao} onChange={set("situacao")}>
            <option value="">Todas</option>
            {Object.entries(situationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FilterSelect>
          <div role="group" aria-labelledby="filtro-disponibilidade" className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
            <span id="filtro-disponibilidade" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Disponível em</span>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(periodoLabels).map(([value, label]) => {
                const active = filters.disponibilidade.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAvailability(value)}
                    className={`h-10 rounded-md border text-xs font-bold transition-colors ${
                      active ? "border-marinho-800 bg-marinho-900 text-white" : "border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => onChange({ ...filters, ...chip.clear })}
                aria-label={`Remover filtro ${chip.label}`}
                className="inline-flex items-center gap-1 rounded-full border border-marinho-200 bg-marinho-50 py-1 pl-3 pr-2 text-sm font-semibold text-marinho-800 hover:bg-marinho-100"
              >
                {chip.label} <X size={14} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="px-2 text-sm font-bold text-marinho-700 hover:underline">
              Limpar filtros
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export default function EstudantesPage() {
  const navigate = useNavigate();
  const [indicating, setIndicating] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const getMenuItems = useCallback(
    (estudante, { edit, remove }) => [
      { key: "profile", label: "Ver perfil", icon: UserRound, onClick: () => navigate(`/estudantes/${estudante.id}`) },
      { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
      { key: "indicate", label: "Indicar para vaga", icon: Send, onClick: () => setIndicating(estudante) },
      { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
    ],
    [navigate],
  );
  const filterItems = useCallback((estudante) => matchesFilters(estudante, filters), [filters]);
  const renderHeader = useCallback(
    ({ items, allItems, isLoading }) => (
      <Filters filters={filters} onChange={setFilters} students={allItems} visibleCount={items.length} isLoading={isLoading} />
    ),
    [filters],
  );

  return (
    <>
      <EntityList
        type="estudante"
        endpoint="candidatos"
        entityLabel={{ singular: "estudante", plural: "estudantes", article: "o" }}
        searchPlaceholder="Buscar por nome, curso ou instituição"
        emptyMessage={hasFilters ? "Nenhum estudante com esses filtros." : "Nenhum estudante cadastrado."}
        getSearchText={getSearchText}
        getName={getName}
        renderEditExtra={renderEditExtra}
        csvExport={csvExport}
        renderItem={renderEstudante}
        filterItems={hasFilters ? filterItems : undefined}
        renderHeader={renderHeader}
        getMenuItems={getMenuItems}
      />
      <Modal isOpen={Boolean(indicating)} title="Indicar para vaga" onClose={() => setIndicating(null)}>
        {indicating && (
          <IndicateDialog studentId={indicating.id} onDone={() => setIndicating(null)} onCancel={() => setIndicating(null)} />
        )}
      </Modal>
    </>
  );
}
