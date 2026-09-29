import { useState } from "react";
import { ArrowRight, GraduationCap, LoaderCircle, X } from "lucide-react";
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
  const [loginSuccess, setLoginSuccess] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryLogin, setRecoveryLogin] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setLoginSuccess("");
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

  function openRecovery() {
    setRecoveryLogin(login);
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryError("");
    setRecoveryStep(1);
    setRecoveryOpen(true);
  }

  async function requestRecoveryCode(event) {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      await api.post("/franquias/esqueci-senha", { login: recoveryLogin });
      setRecoveryStep(2);
    } catch (requestError) {
      setRecoveryError(requestError.response?.data?.erro || "Não foi possível solicitar o código.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const { data } = await api.post("/franquias/resetar-senha", {
        login: recoveryLogin,
        codigo: recoveryCode,
        novaSenha: recoveryPassword,
      });
      setLogin(recoveryLogin);
      setSenha("");
      setLoginSuccess(data.mensagem || "Senha redefinida. Entre com sua nova senha.");
      setRecoveryOpen(false);
      setRecoveryCode("");
      setRecoveryPassword("");
    } catch (requestError) {
      setRecoveryError(requestError.response?.data?.erro || "Não foi possível redefinir a senha.");
    } finally {
      setRecoveryLoading(false);
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
                minLength={mode === "register" ? 6 : undefined}
                onChange={(event) => setSenha(event.target.value)}
                placeholder={mode === "register" ? "Mínimo de 6 caracteres" : "Sua senha"}
                required
                type="password"
                value={senha}
              />
            </label>
            {mode === "login" && (
              <div className="-mt-2 flex justify-end">
                <button
                  className="text-sm font-semibold text-brand-blue transition hover:text-blue-800 hover:underline"
                  onClick={openRecovery}
                  type="button"
                >
                  Esqueci minha senha?
                </button>
              </div>
            )}
            {error && <p aria-live="polite" className="text-sm text-rose-700">{error}</p>}
            {loginSuccess && <p aria-live="polite" className="text-sm text-emerald-700">{loginSuccess}</p>}
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

      {recoveryOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-brand-dark/60 p-4">
          <section
            aria-labelledby="recovery-title"
            aria-modal="true"
            className="w-full max-w-md rounded-lg border-t-4 border-brand-blue bg-white shadow-xl"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-brand-blue">ETAPA {recoveryStep} DE 2</p>
                <h2 className="mt-1 font-display text-lg font-bold text-brand-dark" id="recovery-title">
                  {recoveryStep === 1 ? "Recuperar senha" : "Redefinir senha"}
                </h2>
              </div>
              <button
                aria-label="Fechar recuperação de senha"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-brand-blue-light hover:text-brand-blue"
                onClick={() => setRecoveryOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            {recoveryStep === 1 ? (
              <form className="space-y-4 p-5" onSubmit={requestRecoveryCode}>
                <p className="text-sm text-slate-600">Informe o login da franquia para receber um código de recuperação.</p>
                <label className="block text-sm font-medium text-slate-700" htmlFor="recovery-login">
                  Login
                  <input
                    autoComplete="username"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    id="recovery-login"
                    onChange={(event) => setRecoveryLogin(event.target.value)}
                    required
                    value={recoveryLogin}
                  />
                </label>
                {recoveryError && <p aria-live="polite" className="text-sm text-rose-700">{recoveryError}</p>}
                <button
                  className="login-primary-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-60"
                  disabled={recoveryLoading}
                  type="submit"
                >
                  {recoveryLoading && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
                  Enviar Código
                </button>
              </form>
            ) : (
              <form className="space-y-4 p-5" onSubmit={resetPassword}>
                <p className="text-sm text-slate-600">Digite o código recebido e escolha uma nova senha.</p>
                <label className="block text-sm font-medium text-slate-700" htmlFor="recovery-code">
                  Código recebido
                  <input
                    autoComplete="one-time-code"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-mono tracking-[0.2em] text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    id="recovery-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                    value={recoveryCode}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700" htmlFor="recovery-new-password">
                  Nova senha
                  <input
                    autoComplete="new-password"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                    id="recovery-new-password"
                    minLength={6}
                    onChange={(event) => setRecoveryPassword(event.target.value)}
                    required
                    type="password"
                    value={recoveryPassword}
                  />
                </label>
                {recoveryError && <p aria-live="polite" className="text-sm text-rose-700">{recoveryError}</p>}
                <button
                  className="login-primary-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-60"
                  disabled={recoveryLoading || recoveryCode.length !== 6}
                  type="submit"
                >
                  {recoveryLoading && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
                  Redefinir senha
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default LoginPage;