import { useEffect, useState } from "react";
import { Building2, LoaderCircle, Plus, X } from "lucide-react";
import { api } from "../api.js";
import Card from "../components/Card.jsx";

const emptyForm = {
  nome_razao_social: "",
  contato_principal: "",
  email_contato: "",
};

function Empresas() {
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/empresas")
      .then(({ data }) => {
        if (active) setEmpresas(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.erro || "Não foi possível carregar as empresas.");
      })
      .finally(() => {
        if (active) setLoading(false);
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
      const { data } = await api.post("/empresas", {
        nome_razao_social: form.nome_razao_social.trim(),
        contato_principal: form.contato_principal.trim(),
        email_contato: form.email_contato.trim() || null,
      });
      setEmpresas((current) => [data, ...current.filter((empresa) => empresa.id !== data.id)]);
      setForm(emptyForm);
      setFormOpen(false);
      setSuccess("Empresa cadastrada com sucesso.");
    } catch (requestError) {
      setError(requestError.response?.data?.erro || "Não foi possível cadastrar a empresa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-brand-blue">GESTÃO DA FRANQUIA</p>
          <h1 className="font-display text-3xl font-semibold text-brand-dark">Empresas</h1>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          onClick={() => {
            setError("");
            setFormOpen((open) => !open);
          }}
          type="button"
        >
          {formOpen ? <X aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
          {formOpen ? "Cancelar" : "Nova empresa"}
        </button>
      </div>

      {success && <p aria-live="polite" className="text-sm text-emerald-700">{success}</p>}

      {formOpen && (
        <Card title="Cadastrar empresa">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2" htmlFor="company-name">
              Nome / Razão social
              <input
                autoComplete="organization"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="company-name"
                name="nome_razao_social"
                onChange={updateField}
                required
                value={form.nome_razao_social}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700" htmlFor="company-contact">
              Contato principal
              <input
                autoComplete="name"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="company-contact"
                name="contato_principal"
                onChange={updateField}
                required
                value={form.contato_principal}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700" htmlFor="company-email">
              E-mail de contato <span className="font-normal text-slate-400">(opcional)</span>
              <input
                autoComplete="email"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="company-email"
                name="email_contato"
                onChange={updateField}
                type="email"
                value={form.email_contato}
              />
            </label>
            {error && <p aria-live="polite" className="text-sm text-rose-700 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <button
                className="inline-flex min-h-11 min-w-40 items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
                Cadastrar empresa
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Empresas cadastradas (${empresas.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="px-3 py-3 font-semibold">Empresa</th>
                <th className="px-3 py-3 font-semibold">Contato principal</th>
                <th className="px-3 py-3 font-semibold">E-mail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={3}>Carregando empresas...</td></tr>
              ) : empresas.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={3}>
                    <Building2 aria-hidden="true" className="mx-auto mb-2 text-slate-400" size={22} />
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              ) : empresas.map((empresa) => (
                <tr className="text-slate-700" key={empresa.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">{empresa.nome_razao_social || empresa.nome}</td>
                  <td className="px-3 py-3">{empresa.contato_principal || empresa.contato}</td>
                  <td className="px-3 py-3">{empresa.email_contato || empresa.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default Empresas;