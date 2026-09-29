import { useState } from "react";
import { ArrowRight, GraduationCap, LoaderCircle } from "lucide-react";
import { api } from "../api.js";
import Card from "./Card.jsx";

function LoginPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        await api.post("/franquias", { nome, cidade, login, senha });
      }
      const { data } = await api.post("/auth/login", { login, senha });
      window.localStorage.setItem("accessToken", data.token);
      onAuthenticated(data.token);
    } catch (requestError) {
      setError(requestError.response?.data?.erro || "Não foi possível entrar. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-light px-5 py-10">
      <div className="w-full max-w-[420px]">
        <Card
          className="border-l-4 border-l-brand-blue shadow-lg"
          headerAction={(
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/70 text-brand-blue">
              <GraduationCap aria-hidden="true" size={21} />
            </span>
          )}
          title="Super Estágios"
        >
          <div className="mb-6">
            <h1 className="font-display text-xl font-bold text-brand-dark">
              {mode === "register" ? "Cadastre sua franquia" : "Recrutamento & Seleção"}
            </h1>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <label className="block text-sm font-medium text-slate-700" htmlFor="franchise-name">
                  Nome da franquia
                  <input
                    autoComplete="organization"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    id="franchise-name"
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Nome da franquia"
                    required
                    value={nome}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700" htmlFor="franchise-city">
                  Cidade
                  <input
                    autoComplete="address-level2"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    id="franchise-city"
                    onChange={(event) => setCidade(event.target.value)}
                    placeholder="Cidade da franquia"
                    required
                    value={cidade}
                  />
                </label>
              </>
            )}
            <label className="block text-sm font-medium text-slate-700" htmlFor="login">
              Login
              <input
                autoComplete="username"
                autoFocus
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="login"
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Seu login"
                required
                value={login}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700" htmlFor="senha">
              Senha
              <input
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                id="senha"
                minLength={mode === "register" ? 12 : undefined}
                onChange={(event) => setSenha(event.target.value)}
                placeholder={mode === "register" ? "Mínimo de 12 caracteres" : "Sua senha"}
                required
                type="password"
                value={senha}
              />
            </label>
            {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
            <button
              className="login-primary-button mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-blue-800 px-4 text-sm font-bold shadow-sm transition disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <ArrowRight aria-hidden="true" size={17} />}
              <span>{mode === "register" ? "Cadastrar e entrar" : "Entrar"}</span>
            </button>
          </form>
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <button
              className="text-sm font-semibold text-brand-blue transition hover:text-blue-800"
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setError("");
              }}
              type="button"
            >
              {mode === "register" ? "Já tenho acesso" : "Cadastrar franquia"}
            </button>
          </div>
        </Card>
        <p className="mt-5 text-center text-xs text-slate-500">Acesso exclusivo para franquias Super Estágios</p>
      </div>
    </main>
  );
}

export default LoginPage;