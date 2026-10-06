import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Mail, MessageCircle, Pencil, Trash2 } from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import EntityList from "../components/EntityList.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { statusLabels } from "../vagaStatus.js";
import { csvDate } from "../csv.js";
import { formatPhone, whatsappLink } from "../text.js";
import { hasNoOpenJob } from "../regras.js";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

const contactButton =
  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors";
const contactDisabled = "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400";

function toVagas(empresa) {
  return { pathname: "/vagas", search: `?empresa=${empresa.id}` };
}

function Numbers({ resumo }) {
  const numbers = [
    { label: "vagas abertas", value: resumo?.vagas_abertas ?? 0 },
    { label: "em processo", value: resumo?.em_processo ?? 0 },
    { label: "contratados", value: resumo?.contratados ?? 0 },
  ];
  return (
    <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-200 rounded-md bg-slate-50 py-3 text-center">
      {numbers.map((number) => (
        <div key={number.label} className="px-1">
          <dt className="sr-only">{number.label}</dt>
          <dd className="text-2xl font-extrabold leading-none text-marinho-900">{number.value}</dd>
          <dd aria-hidden="true" className="mt-1 text-xs text-slate-500">{number.label}</dd>
        </div>
      ))}
    </dl>
  );
}

function LastJob({ empresa }) {
  const lastJob = empresa.vagas?.[0];
  return (
    <p className="mt-5 rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
      {lastJob ? (
        <>
          Última vaga: <span className="font-semibold text-slate-800">{lastJob.titulo}</span>
          <span className="text-slate-500"> · {statusLabels[lastJob.status]} · {dateFormat.format(new Date(lastJob.created_at))}</span>
        </>
      ) : (
        <span className="text-slate-500">Nunca teve vaga cadastrada</span>
      )}
    </p>
  );
}

function Contact({ empresa }) {
  const whatsapp = whatsappLink(empresa.telefone_contato);
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Responsável</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{empresa.nome_contato}</p>
      <p className="text-sm text-slate-500">{formatPhone(empresa.telefone_contato)}</p>
      <div className="mt-3 flex gap-2">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={`${contactButton} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
        ) : (
          <span className={`${contactButton} ${contactDisabled}`} title="Telefone sem DDD">
            <MessageCircle size={15} /> WhatsApp
          </span>
        )}
        {empresa.email_contato ? (
          <a
            href={`mailto:${empresa.email_contato}`}
            title={empresa.email_contato}
            className={`${contactButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}
          >
            <Mail size={15} /> E-mail
          </a>
        ) : (
          <span className={`${contactButton} ${contactDisabled}`} title="Sem e-mail cadastrado">
            <Mail size={15} /> E-mail
          </span>
        )}
      </div>
    </div>
  );
}

// Card da empresa; a tela "Empresas sem vaga" troca os números pela última vaga.
function renderEmpresa(empresa, { showLastJob = false } = {}) {
  return (
    <>
      <div className="flex items-center gap-3 pr-10">
        <CompanyAvatar id={empresa.id} name={empresa.nome} logoUrl={empresa.logo_url} size="lg" />
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-snug text-marinho-900">{empresa.nome}</h2>
          <p className="truncate text-sm text-slate-500">{empresa.setor}</p>
        </div>
      </div>

      {showLastJob ? <LastJob empresa={empresa} /> : <Numbers resumo={empresa.resumo} />}
      <Contact empresa={empresa} />

      <div className="mt-auto border-t border-slate-100 pt-4">
        <Link
          to={toVagas(empresa)}
          state={{ empresaNome: empresa.nome }}
          className="text-sm font-bold text-marinho-700 transition-colors hover:text-marinho-900 hover:underline"
        >
          Ver vagas <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </>
  );
}

const getSearchText = (empresa) => `${empresa.nome} ${empresa.setor ?? ""} ${empresa.nome_contato ?? ""}`;
const getName = (empresa) => empresa.nome;
const renderEmpresaSemVaga = (empresa) => renderEmpresa(empresa, { showLastJob: true });

function useEmpresaMenu() {
  const navigate = useNavigate();
  return useCallback(
    (empresa, { edit, remove }) => [
      {
        key: "jobs",
        label: "Ver vagas da empresa",
        icon: BriefcaseBusiness,
        onClick: () => navigate(toVagas(empresa), { state: { empresaNome: empresa.nome } }),
      },
      { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
      { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
    ],
    [navigate],
  );
}

function renderCount({ items, isLoading }) {
  return (
    <div className="mb-5">
      <p className="text-lg text-slate-700">
        <strong className="text-2xl font-extrabold text-marinho-900">{isLoading ? "…" : items.length}</strong>{" "}
        {items.length === 1 ? "empresa" : "empresas"}
      </p>
    </div>
  );
}

export function EmpresasPage() {
  const getMenuItems = useEmpresaMenu();
  return (
    <EntityList
      type="empresa"
      endpoint="empresas"
      entityLabel={{ singular: "empresa", plural: "empresas", article: "a" }}
      searchPlaceholder="Buscar empresa ou responsável"
      emptyMessage="Nenhuma empresa cadastrada."
      getSearchText={getSearchText}
      getName={getName}
      renderItem={renderEmpresa}
      renderHeader={renderCount}
      getMenuItems={getMenuItems}
    />
  );
}

const semVagaCsv = {
  filename: "empresas-sem-vaga",
  columns: [
    { header: "Empresa", value: (empresa) => empresa.nome },
    { header: "Setor", value: (empresa) => empresa.setor },
    { header: "Contato", value: (empresa) => empresa.nome_contato },
    { header: "Telefone", value: (empresa) => formatPhone(empresa.telefone_contato) },
    { header: "E-mail", value: (empresa) => empresa.email_contato },
    { header: "Vagas anteriores", value: (empresa) => empresa.vagas?.length ?? 0 },
    { header: "Última vaga", value: (empresa) => empresa.vagas?.[0]?.titulo },
    { header: "Criada em", value: (empresa) => csvDate(empresa.vagas?.[0]?.created_at) },
  ],
};

function renderSemVagaHeader({ items, isLoading }) {
  return (
    <PageHeader>
      <p className="text-sm text-slate-600">
        <strong className="text-base font-extrabold text-marinho-900">{isLoading ? "…" : items.length}</strong>{" "}
        {items.length === 1 ? "empresa parceira" : "empresas parceiras"} sem nenhuma vaga aberta no momento — boas candidatas a
        um novo contato
      </p>
    </PageHeader>
  );
}

export function EmpresasSemVagaPage() {
  const getMenuItems = useEmpresaMenu();
  return (
    <EntityList
      type="empresa"
      endpoint="empresas"
      entityLabel={{ singular: "empresa", plural: "empresas", article: "a" }}
      searchPlaceholder="Buscar empresa por nome"
      emptyMessage="Todas as empresas têm ao menos uma vaga aberta."
      getSearchText={getSearchText}
      getName={getName}
      renderItem={renderEmpresaSemVaga}
      renderHeader={renderSemVagaHeader}
      csvExport={semVagaCsv}
      filterItems={hasNoOpenJob}
      getMenuItems={getMenuItems}
    />
  );
}
