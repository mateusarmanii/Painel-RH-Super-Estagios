import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { apiJson } from "../api.js";
import { saveSession } from "../session.js";
import { buttonPrimary, inputBase } from "../ui.js";

// Tela de entrada do painel. Não há cadastro público: os usuários são criados pelo terminal (npm run usuario:criar).
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const { token, usuario } = await apiJson("/auth/login", { method: "POST", body: { email, senha } }, "Não foi possível entrar.");
      saveSession(token, usuario);
      onLogin(usuario);
    } catch (loginError) {
      setError(loginError.message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-marinho-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-md bg-ambar-400 text-base font-extrabold text-marinho-900">
            SE
          </span>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ambar-400">Painel de RH</p>
            <p className="text-lg font-extrabold text-white">Super Estágios</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border-t-4 border-ambar-400 bg-white p-6 shadow-xl sm:p-8" noValidate>
          <h1 className="text-xl font-extrabold text-marinho-900">Entrar</h1>
          <p className="mt-1 text-sm text-slate-600">Use o e-mail e a senha cadastrados para você.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-marinho-900">E-mail</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${inputBase} h-11`}
                placeholder="voce@superestagios.com.br"
              />
            </div>

            <div>
              <label htmlFor="login-senha" className="mb-1.5 block text-sm font-semibold text-marinho-900">Senha</label>
              <div className="relative">
                <input
                  id="login-senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className={`${inputBase} h-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                  title={showPassword ? "Esconder senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-slate-500 transition-colors hover:text-marinho-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting || !email.trim() || !senha} className={`${buttonPrimary} mt-6 h-11 w-full`}>
            <LogIn size={17} /> {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-marinho-200">Acesso restrito à equipe da Super Estágios.</p>
      </div>
    </main>
  );
}
