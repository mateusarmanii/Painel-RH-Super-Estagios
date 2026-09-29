import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  LoaderCircle,
  UsersRound,
} from "lucide-react";
import { api } from "../lib/api.js";
import Card from "./Card.jsx";

function growthLabel(value) {
  if (value === null) return { label: "Novo", icon: ArrowUpRight, color: "text-emerald-700" };
  if (value < 0) return { label: `${value}%`, icon: ArrowDownRight, color: "text-rose-700" };
  return { label: `${value > 0 ? "+" : ""}${value}%`, icon: ArrowUpRight, color: "text-emerald-700" };
}

function Metric({ detail, icon: Icon, label, value }) {
  return (
    <div className="min-w-0 border-b border-r border-slate-100 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <Icon aria-hidden="true" className="text-amber-600" size={16} />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DashboardMetrics({ accessToken, onAuthenticated }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return undefined;

    let active = true;
    api.get("/dashboard")
      .then(({ data }) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.response?.status === 401) {
          window.localStorage.removeItem("accessToken");
          onAuthenticated(null);
          setError("Sua sessão expirou. Entre novamente para atualizar os indicadores.");
          return;
        }
        setError("Não foi possível carregar os indicadores agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, onAuthenticated]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginLoading(true);
    setLoading(true);
    setDashboard(null);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { login, senha });
      window.localStorage.setItem("accessToken", data.token);
      onAuthenticated(data.token);
      setSenha("");
    } catch (requestError) {
      setError(requestError.response?.data?.erro || "Não foi possível entrar. Verifique suas credenciais.");
    } finally {
      setLoginLoading(false);
    }
  }

  const hiresGrowth = dashboard ? growthLabel(dashboard.contratacoes.crescimento_mensal) : growthLabel(0);
  const vacanciesGrowth = dashboard ? growthLabel(dashboard.vagas.crescimento_mensal) : growthLabel(0);

  return (
    <div className="mt-6">
      <Card
        title="Dashboard"
        headerAction={accessToken && <span className="text-xs font-medium text-slate-800">Comparativo mensal</span>}
      >
        {!accessToken ? (
          <form className="mx-auto max-w-md py-2" onSubmit={handleLogin}>
            <p className="mb-5 text-sm text-slate-600">Entre com a conta da franquia para carregar os indicadores.</p>
            <label className="mb-4 block text-sm font-medium text-slate-700" htmlFor="dashboard-login">
              Login
              <input
                autoComplete="username"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                id="dashboard-login"
                onChange={(event) => setLogin(event.target.value)}
                required
                value={login}
              />
            </label>
            <label className="mb-4 block text-sm font-medium text-slate-700" htmlFor="dashboard-password">
              Senha
              <input
                autoComplete="current-password"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                id="dashboard-password"
                onChange={(event) => setSenha(event.target.value)}
                required
                type="password"
                value={senha}
              />
            </label>
            {error && <p aria-live="polite" className="mb-4 text-sm text-rose-700">{error}</p>}
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-dark px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              disabled={loginLoading}
              type="submit"
            >
              {loginLoading && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
              Entrar
            </button>
          </form>
        ) : loading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="animate-spin text-amber-600" size={18} />
            Carregando indicadores
          </div>
        ) : error ? (
          <p aria-live="polite" className="py-10 text-center text-sm text-rose-700">{error}</p>
        ) : dashboard ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6">
              <Metric
                detail={`${hiresGrowth.label} vs. mês anterior`}
                icon={Check}
                label="Contratações no mês"
                value={dashboard.contratacoes.mes}
              />
              <Metric
                detail="Desde janeiro"
                icon={Check}
                label="Contratações no ano"
                value={dashboard.contratacoes.ano}
              />
              <Metric
                detail={`${dashboard.vagas.criadas_no_mes} criada(s) neste mês`}
                icon={vacanciesGrowth.icon}
                label="Crescimento de vagas"
                value={<span className={vacanciesGrowth.color}>{vacanciesGrowth.label}</span>}
              />
              <Metric
                detail="vs. mês anterior"
                icon={hiresGrowth.icon}
                label="Crescimento de contratações"
                value={<span className={hiresGrowth.color}>{hiresGrowth.label}</span>}
              />
              <Metric
                detail="Enviadas ou em seleção"
                icon={BriefcaseBusiness}
                label="Contratações pendentes"
                value={dashboard.contratacoes_pendentes}
              />
              <Metric
                detail="Com entrevista agendada"
                icon={CalendarClock}
                label="Candidatos em entrevista"
                value={dashboard.candidatos_em_entrevista}
              />
            </div>

            <section className="mt-5 border-t border-slate-200 pt-5">
              <div className="mb-4 flex items-center gap-2">
                <UsersRound aria-hidden="true" className="text-amber-600" size={17} />
                <h3 className="text-sm font-semibold text-slate-800">
                  Empresas com vagas abertas há {dashboard.vagas_antigas.limite_dias} dias ou mais
                </h3>
              </div>
              {dashboard.vagas_antigas.empresas.length ? (
                <ul className="divide-y divide-slate-100">
                  {dashboard.vagas_antigas.empresas.map((empresa) => (
                    <li className="py-3 first:pt-0 last:pb-0" key={empresa.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{empresa.nome}</p>
                        <span className="text-xs text-slate-500">{empresa.vagas.length} vaga(s)</span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {empresa.vagas.map((vaga) => (
                          <li className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600" key={vaga.id}>
                            <span>{vaga.codigo} · {vaga.nome}</span>
                            <span className="font-medium text-amber-700">Há {vaga.dias_aberta} dias</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma vaga aberta há 30 dias ou mais.</p>
              )}
            </section>
          </>
        ) : null}
      </Card>
    </div>
  );
}

export default DashboardMetrics;