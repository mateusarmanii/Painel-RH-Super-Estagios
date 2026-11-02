import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import LoadError from "../components/LoadError.jsx";
import { apiJson } from "../api.js";
import { statusLabels } from "../vagaStatus.js";
import { buttonPrimary, card, inputBase } from "../ui.js";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const fromKey = (key) => new Date(`${key}T00:00:00Z`);
const isoDay = (date) => date.toISOString().slice(0, 10);

// Relatório por empresa (para mandar ao cliente): vagas, candidatos enviados, entrevistas e contratações no período.
// "Imprimir / PDF" usa a impressão do navegador (o menu e os botões não saem no papel).
export default function RelatorioEmpresaPage() {
  const { id } = useParams();
  const today = new Date();
  const [range, setRange] = useState({ de: isoDay(new Date(today.getTime() - 89 * 86400000)), ate: isoDay(today) });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiJson(`/relatorios/empresa/${id}?${new URLSearchParams(range)}`, undefined, "Não foi possível gerar o relatório.").then(setData).catch((e) => setError(e.message));
  }, [id, range]);
  useEffect(load, [load]);

  if (error) return <div className="p-6"><LoadError message={error} onRetry={load} /></div>;

  const stats = data && [
    ["Vagas abertas agora", data.totais.vagasAbertas],
    ["Candidatos enviados", data.totais.enviados],
    ["Entrevistas", data.totais.entrevistas],
    ["Contratações", data.totais.contratacoes],
    ["Tempo médio até contratar", data.totais.tempoMedioDias === null ? "—" : `${decimal.format(data.totais.tempoMedioDias)} dias`],
  ];

  return (
    <section className="relatorio min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link to="/empresas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marinho-700 hover:text-marinho-900"><ArrowLeft size={16} /> Empresas</Link>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">De<input type="date" value={range.de} max={range.ate} onChange={(e) => e.target.value && setRange((r) => ({ ...r, de: e.target.value }))} className={`${inputBase} mt-1 h-9 w-40`} /></label>
            <label className="text-xs font-semibold text-slate-600">Até<input type="date" value={range.ate} min={range.de} onChange={(e) => e.target.value && setRange((r) => ({ ...r, ate: e.target.value }))} className={`${inputBase} mt-1 h-9 w-40`} /></label>
            <button type="button" onClick={() => window.print()} className={`${buttonPrimary} h-9`}><Printer size={16} /> Imprimir / PDF</button>
          </div>
        </div>

        {!data ? (
          <div className={`${card} h-64 animate-pulse`} />
        ) : (
          <article className={`${card} space-y-6 p-6 print:border-0 print:shadow-none`}>
            <header className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <CompanyAvatar id={data.empresa.id} name={data.empresa.nome} logoId={data.empresa.logo_arquivo_id} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Relatório de recrutamento · Super Estágios</p>
                <h1 className="text-2xl font-extrabold text-marinho-900">{data.empresa.nome}</h1>
                <p className="text-sm text-slate-600">{dayFormat.format(fromKey(data.periodo.de))} a {dayFormat.format(fromKey(data.periodo.ate))}</p>
              </div>
            </header>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-marinho-900">{value}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h2 className="mb-2 text-sm font-extrabold text-marinho-900">Vagas</h2>
              {data.vagas.length === 0 ? (
                <p className="text-sm text-slate-500">Sem vagas ou movimento no período.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr><th className="py-2">Vaga</th><th className="py-2">Status</th><th className="py-2 text-right">Enviados</th><th className="py-2 text-right">Entrevistas</th><th className="py-2 text-right">Contratados</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.vagas.map((vaga) => (
                      <tr key={vaga.id}>
                        <td className="py-2"><span className="font-semibold text-marinho-900">{vaga.titulo}</span> <span className="text-xs text-slate-500">Nº {vaga.codigo_vaga}</span></td>
                        <td className="py-2 text-slate-600">{statusLabels[vaga.status] ?? vaga.status}</td>
                        <td className="py-2 text-right tabular-nums">{vaga.enviados}</td>
                        <td className="py-2 text-right tabular-nums">{vaga.entrevistas}</td>
                        <td className="py-2 text-right tabular-nums">{vaga.contratados.length}{vaga.quantidade ? ` de ${vaga.quantidade}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {data.totais.contratacoes > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-extrabold text-marinho-900">Contratações</h2>
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.vagas.flatMap((vaga) => vaga.contratados.map((pessoa) => ({ ...pessoa, vaga: vaga.titulo }))).map((pessoa, index) => (
                    <li key={`${pessoa.nome}-${index}`} className="flex flex-wrap justify-between gap-2 py-2">
                      <span><strong className="text-marinho-900">{pessoa.nome}</strong> · {pessoa.curso} · {pessoa.vaga}</span>
                      <span className="text-slate-500">{dayFormat.format(new Date(pessoa.data))} · {pessoa.dias} dias{pessoa.taxa !== null ? ` · ${money.format(pessoa.taxa)}` : ""}</span>
                    </li>
                  ))}
                </ul>
                {data.totais.taxas !== null && <p className="mt-2 text-right text-sm font-semibold text-marinho-900">Taxas de agenciamento: {money.format(data.totais.taxas)}</p>}
              </section>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
