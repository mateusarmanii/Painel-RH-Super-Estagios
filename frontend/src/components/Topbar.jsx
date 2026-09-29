import { useState } from "react";
import { Bell, Clock3, LoaderCircle, LogOut, Menu } from "lucide-react";
import { KeyRound, X } from "lucide-react";
import { api } from "../api.js";

function Topbar({ activeItem, onLogout, onMenuClick }) {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handlePasswordChange(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não corresponde à nova senha.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { data } = await api.put("/franquias/senha", {
        senhaAtual: currentPassword,
        novaSenha: newPassword,
      });
      setPasswordSuccess(data.mensagem);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setPasswordError(requestError.response?.data?.erro || "Não foi possível alterar a senha.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-white px-5 shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <button
            aria-label="Abrir navegação"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
            onClick={onMenuClick}
            title="Abrir navegação"
            type="button"
          >
            <Menu aria-hidden="true" size={19} />
          </button>
          <div>
            <p className="text-xs font-medium text-slate-500">SUPER ESTÁGIOS</p>
            <p className="mt-0.5 text-sm font-semibold text-brand-dark">{activeItem}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            aria-label="Registrar ponto"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-brand-blue-light hover:text-brand-blue"
            title="Registrar ponto"
            type="button"
          >
            <Clock3 aria-hidden="true" size={19} />
          </button>
          <button
            aria-label="Alterar senha"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-brand-blue-light hover:text-brand-blue"
            onClick={() => {
              setPasswordError("");
              setPasswordSuccess("");
              setPasswordDialogOpen(true);
            }}
            title="Alterar senha"
            type="button"
          >
            <KeyRound aria-hidden="true" size={19} />
          </button>
          <button
            aria-label="Notificações"
            className="relative inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-brand-blue-light hover:text-brand-blue"
            title="Notificações"
            type="button"
          >
            <Bell aria-hidden="true" size={19} />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-blue" />
          </button>
          <div className="mx-2 hidden h-8 w-px bg-slate-200 sm:block" />
          <button
            aria-label="Sair"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-700"
            onClick={onLogout}
            title="Sair"
            type="button"
          >
            <LogOut aria-hidden="true" size={19} />
          </button>
        </div>
      </header>

      {passwordDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/50 p-4">
          <section aria-labelledby="change-password-title" aria-modal="true" className="w-full max-w-md rounded-lg bg-white shadow-xl" role="dialog">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-brand-dark" id="change-password-title">Alterar senha</h2>
              <button
                aria-label="Fechar"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-blue"
                onClick={() => setPasswordDialogOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <form className="space-y-4 p-5" onSubmit={handlePasswordChange}>
              <label className="block text-sm font-medium text-slate-700" htmlFor="current-password">
                Senha atual
                <input
                  autoComplete="current-password"
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700" htmlFor="new-password">
                Nova senha
                <input
                  autoComplete="new-password"
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  id="new-password"
                  minLength={6}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-password">
                Confirmar nova senha
                <input
                  autoComplete="new-password"
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                  id="confirm-password"
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
              {passwordError && <p aria-live="polite" className="text-sm text-rose-700">{passwordError}</p>}
              {passwordSuccess && <p aria-live="polite" className="text-sm text-emerald-700">{passwordSuccess}</p>}
              <button
                className="login-primary-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-60"
                disabled={passwordSaving}
                type="submit"
              >
                {passwordSaving && <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />}
                Salvar nova senha
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default Topbar;