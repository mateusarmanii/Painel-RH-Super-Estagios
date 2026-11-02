import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Moldura das páginas públicas (sem login): faixa com a marca, conteúdo centralizado e rodapé.
export default function PublicShell({ title, children, wide = false }) {
  useEffect(() => {
    document.title = title ? `${title} · Super Estágios` : "Super Estágios";
  }, [title]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-marinho-900">
        <div className={`mx-auto flex items-center gap-3 px-4 py-4 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-md bg-ambar-400 text-sm font-extrabold text-marinho-900">SE</span>
          <p className="text-lg font-extrabold text-white">Super Estágios</p>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${wide ? "max-w-5xl" : "max-w-xl"}`}>{children}</main>
      <footer className="py-6 text-center text-xs text-slate-400">Super Estágios · Agente de integração de estágios</footer>
    </div>
  );
}

export function PublicLoading() {
  return (
    <div className="grid place-items-center py-16 text-slate-500" aria-busy="true">
      <Loader2 className="animate-spin" size={24} />
    </div>
  );
}

export function PublicMessage({ icon: Icon, tone = "slate", title, children }) {
  const tones = {
    slate: "bg-marinho-50 text-marinho-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {Icon && (
        <span className={`mx-auto grid size-12 place-items-center rounded-full ${tones[tone]}`}>
          <Icon size={22} />
        </span>
      )}
      <h1 className="mt-4 text-lg font-extrabold text-marinho-900">{title}</h1>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

// Lê o corpo JSON de uma resposta pública; erro vira exceção com a mensagem da API.
export async function publicJson(promise, fallback) {
  const response = await promise;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.erro ?? fallback);
  return body;
}
