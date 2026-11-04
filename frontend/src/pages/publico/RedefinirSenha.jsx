import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";
import { apiFetch, OFFLINE_MESSAGE } from "../../api.js";
import { buttonPrimary, inputBase } from "../../ui.js";
import PublicShell, { PublicMessage, publicJson } from "./PublicShell.jsx";

const MIN_LENGTH = 10;

// Nova senha a partir do link do e-mail "Esqueci minha senha" (vale 1 hora e uma vez só).
export default function RedefinirSenhaPage() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < MIN_LENGTH) return setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
    if (password !== confirmation) return setError("As duas senhas não são iguais.");
    setBusy(true);
    setError("");
    try {
      await publicJson(apiFetch("/auth/redefinir", { method: "POST", body: { token, senha: password } }), "Não foi possível alterar a senha.");
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof TypeError ? OFFLINE_MESSAGE : submitError.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  if (done) {
    return (
      <PublicShell title="Senha alterada">
        <PublicMessage icon={CheckCircle2} tone="green" title="Senha alterada">
          <Link to="/" className="font-semibold text-marinho-700 underline">Entrar no painel</Link>
        </PublicMessage>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="Nova senha">
      <form onSubmit={submit} className="superficie rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="grid size-11 place-items-center rounded-full bg-marinho-50 text-marinho-700"><KeyRound size={20} /></span>
        <h1 className="mt-3 text-xl font-extrabold text-marinho-900">Criar nova senha</h1>
        <label className="mt-5 block text-sm font-semibold text-marinho-900">
          Nova senha
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputBase} mt-1.5 h-11`} />
        </label>
        <label className="mt-4 block text-sm font-semibold text-marinho-900">
          Repita a senha
          <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={`${inputBase} mt-1.5 h-11`} />
        </label>
        <p className="mt-2 text-xs text-slate-500">Mínimo de {MIN_LENGTH} caracteres.</p>
        {error && <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className={`${buttonPrimary} mt-6 h-11 w-full`}>{busy ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
    </PublicShell>
  );
}
