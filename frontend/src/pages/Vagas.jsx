import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Card from "../components/Card.jsx";

const emptyForm = { titulo: "", codigo: "", empresa_id: "", link: "" };

function Vagas() {
  const [vagas, setVagas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/vagas")
      .then(({ data }) => {
        if (active) setVagas(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.erro || "Não foi possível carregar as vagas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.get("/empresas")
      .then(({ data }) => {
        if (active) setEmpresas(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.erro || "Não foi possível carregar as empresas.");
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/vagas", {
        ...form,
        codigo: form.codigo.trim(),
        empresa_id: Number(form.empresa_id),
      });
      setVagas((current) => [data, ...current.filter((vaga) => vaga.id !== data.id)]);
      setForm(emptyForm);
      setSuccess("Vaga cadastrada com sucesso.");
    } catch (requestError) {
      setError(requestError.response?.data?.erro || "Não foi possível cadastrar a vaga.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold text-brand-blue">GESTÃO DE OPORTUNIDADES</p>
        <h1 className="font-display text-3xl font-semibold text-brand-dark">Vagas</h1>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.5fr)]">
        <Card title="Nova vaga">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="vacancy-title">
              Título
              <input
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="vacancy-title"
                name="titulo"
                onChange={updateField}
                required
                value={form.titulo}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700" htmlFor="vacancy-code">
              Código da vaga
              <input
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="vacancy-code"
                inputMode="numeric"
                maxLength={6}
                name="codigo"
                onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                pattern="[0-9]{6}"
                placeholder="6 dígitos"
                required
                value={form.codigo}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700" htmlFor="vacancy-company">
              Empresa
              <select
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="vacancy-company"
                name="empresa_id"
                onChange={updateField}
                required
                value={form.empresa_id}
              >
                <option value="">Selecione uma empresa</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700" htmlFor="vacancy-link">
              Link da vaga
              <input
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="vacancy-link"
                name="link"
                onChange={updateField}
                placeholder="https://"
                required
                type="url"
                value={form.link}
              />
            </label>

            {empresas.length === 0 && !loading && (
              <p className="text-xs text-slate-500">
                Nenhuma empresa cadastrada. <Link className="font-semibold text-brand-blue hover:underline" to="/empresas">Ver empresas</Link>
              </p>
            )}
            {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
            {success && <p aria-live="polite" className="text-sm text-emerald-700">{success}</p>}
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || empresas.length === 0}
              type="submit"
            >
              {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <Plus aria-hidden="true" size={17} />}
              Cadastrar vaga
            </button>
          </form>
        </Card>

        <Card title={`Vagas cadastradas (${vagas.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-3 py-3 font-semibold">Código</th>
                  <th className="px-3 py-3 font-semibold">Título</th>
                  <th className="px-3 py-3 font-semibold">Empresa</th>
                  <th className="px-3 py-3 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={4}>Carregando vagas...</td></tr>
                ) : vagas.length === 0 ? (
                  <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={4}>Nenhuma vaga cadastrada.</td></tr>
                ) : vagas.map((vaga) => (
                  <tr className="text-slate-700" key={vaga.id}>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-dark">{vaga.codigo}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{vaga.nome}</td>
                    <td className="px-3 py-3">{vaga.empresa?.nome || "—"}</td>
                    <td className="px-3 py-3">
                      <a className="inline-flex items-center gap-1 text-brand-blue hover:underline" href={vaga.link} rel="noreferrer" target="_blank">
                        Abrir <ExternalLink aria-hidden="true" size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Vagas;