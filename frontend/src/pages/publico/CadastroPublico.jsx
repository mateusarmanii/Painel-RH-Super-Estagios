import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Clock, MapPin, Search, XCircle } from "lucide-react";
import { apiFetch, OFFLINE_MESSAGE } from "../../api.js";
import { modalidadeLabels, turnoVagaLabels } from "../../estudante.js";
import { normalize } from "../../text.js";
import { buttonPrimary, inputBase } from "../../ui.js";
import PublicShell, { PublicLoading, PublicMessage, publicJson } from "./PublicShell.jsx";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const EMPTY = { nome_completo: "", telefone: "", email: "", curso: "", instituicao_ensino: "", cidade: "", site: "" };

// Página pública de vagas + cadastro do estudante (só funciona com o formulário público ligado nas Configurações).
export default function CadastroPublicoPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState("");

  useEffect(() => {
    publicJson(apiFetch("/publico/vagas"), "Não foi possível carregar as vagas.")
      .then(setJobs)
      .catch((loadError) => setError(loadError instanceof TypeError ? OFFLINE_MESSAGE : loadError.message));
  }, []);

  const visible = useMemo(() => {
    const term = normalize(query);
    return (jobs ?? []).filter((job) => !term || normalize(`${job.titulo} ${job.area ?? ""} ${job.cidade ?? ""} ${job.codigo_vaga}`).includes(term));
  }, [jobs, query]);

  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const result = await publicJson(
        apiFetch("/publico/candidatura", { method: "POST", body: { ...form, vaga_id: selected?.id, consentimento: consent } }),
        "Não foi possível enviar o cadastro.",
      );
      setSent(result.mensagem);
    } catch (submitError) {
      setFormError(submitError instanceof TypeError ? OFFLINE_MESSAGE : submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <PublicShell title="Vagas de estágio" wide>
        <PublicMessage icon={XCircle} tone="red" title="Página indisponível">{error}</PublicMessage>
      </PublicShell>
    );
  }
  if (!jobs) return <PublicShell title="Vagas de estágio" wide><PublicLoading /></PublicShell>;
  if (sent) {
    return (
      <PublicShell title="Cadastro recebido" wide>
        <PublicMessage icon={CheckCircle2} tone="green" title="Cadastro recebido!">{sent}</PublicMessage>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="Vagas de estágio" wide>
      <h1 className="text-2xl font-extrabold text-marinho-900">Vagas de estágio abertas</h1>
      <p className="mt-1 text-sm text-slate-600">Escolha uma vaga (opcional) e faça seu cadastro. Nossa equipe entra em contato.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Vagas">
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-marinho-600">
            <Search size={16} className="text-slate-400" />
            <span className="sr-only">Buscar vaga</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, área ou cidade" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {visible.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">Nenhuma vaga encontrada. Você ainda pode se cadastrar ao lado.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visible.map((job) => {
                const active = selected?.id === job.id;
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(active ? null : job)}
                      className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors ${active ? "border-ambar-400 ring-2 ring-ambar-400/40" : "border-slate-200 hover:border-marinho-200"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-extrabold text-marinho-900">{job.titulo}</p>
                          <p className="text-xs text-slate-500">Nº {job.codigo_vaga}{job.empresa ? ` · ${job.empresa}` : ""}{job.area ? ` · ${job.area}` : ""}</p>
                        </div>
                        {job.valor > 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{money.format(job.valor)}</span>}
                      </div>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {(job.cidade || job.modalidade) && (
                          <span className="inline-flex items-center gap-1"><MapPin size={13} />{[modalidadeLabels[job.modalidade], job.cidade, job.bairro].filter(Boolean).join(" · ")}</span>
                        )}
                        {(job.turno || job.horario) && (
                          <span className="inline-flex items-center gap-1"><Clock size={13} />{[turnoVagaLabels[job.turno], job.horario].filter(Boolean).join(" · ")}</span>
                        )}
                      </p>
                      {active && job.descricao && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{job.descricao}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form onSubmit={submit} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-base font-extrabold text-marinho-900">Meu cadastro</h2>
          <p className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <BriefcaseBusiness size={14} className="shrink-0" />
            {selected ? <>Vaga: <strong className="text-marinho-900">{selected.titulo}</strong></> : "Sem vaga escolhida (cadastro geral)"}
          </p>
          {[
            ["nome_completo", "Nome completo *", "text", "name"],
            ["telefone", "Telefone com DDD *", "tel", "tel"],
            ["email", "E-mail", "email", "email"],
            ["curso", "Curso *", "text", "off"],
            ["instituicao_ensino", "Instituição de ensino", "text", "off"],
            ["cidade", "Cidade", "text", "address-level2"],
          ].map(([name, label, type, autoComplete]) => (
            <label key={name} className="block text-xs font-semibold text-slate-700">
              {label}
              <input type={type} autoComplete={autoComplete} value={form[name]} onChange={set(name)} required={label.endsWith("*")} className={`${inputBase} mt-1 h-10`} />
            </label>
          ))}
          {/* Campo escondido contra robôs. */}
          <input type="text" name="site" tabIndex={-1} autoComplete="off" value={form.site} onChange={set("site")} className="hidden" aria-hidden="true" />
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-marinho-700" />
            <span>Autorizo a Super Estágios a guardar e usar meus dados para me indicar a vagas de estágio (LGPD). Posso pedir a exclusão a qualquer momento.</span>
          </label>
          {formError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
          <button type="submit" disabled={busy || !consent} className={`${buttonPrimary} h-11 w-full`}>{busy ? "Enviando..." : "Enviar cadastro"}</button>
        </form>
      </div>
    </PublicShell>
  );
}
