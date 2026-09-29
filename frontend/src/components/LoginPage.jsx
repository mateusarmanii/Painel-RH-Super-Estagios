import { useState } from "react";
import { ArrowRight, GraduationCap, LoaderCircle } from "lucide-react";
import { api } from "../lib/api.js";
import Card from "./Card.jsx";

function LoginPage({ onAuthenticated }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
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
          className="shadow-lg"
          headerAction={(
            <span className="flex size-9 items-center justify-center rounded-lg bg-black/10">
              <GraduationCap aria-hidden="true" size={21} />
            </span>
          )}
          title="Super Estágios"
        >
          <div className="mb-6">
            <h1 className="font-display text-xl font-bold text-brand-dark">Recrutamento &amp; Seleção</h1>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="login">
              Login
              <input
                autoComplete="username"
                autoFocus
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
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
                autoComplete="current-password"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                id="senha"
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Sua senha"
                required
                type="password"
                value={senha}
              />
            </label>
            {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
            <button
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <ArrowRight aria-hidden="true" size={17} />}
              Entrar
            </button>
          </form>
        </Card>
        <p className="mt-5 text-center text-xs text-slate-500">Acesso exclusivo para franquias Super Estágios</p>
      </div>
    </main>
  );
}

export default LoginPage;