import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { apiFetch } from "../api.js";

const REFRESH_MS = 2 * 60 * 1000;
const STORAGE_KEY = "notificacoesLidas";
const dotStyles = { alta: "bg-rose-500", media: "bg-amber-500", info: "bg-sky-500" };
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function readSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function when(date) {
  const minutes = Math.round((new Date(date) - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

// Sino do topo: entrevistas próximas, pedidos de remarcação, vagas paradas ou com prazo, contratos e relatórios de
// estágio, retornos combinados, pareceres de empresas e cadastros pelo site. "Lida" fica só neste navegador.
export default function NotificationBell() {
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(readSeen);
  const [isOpen, setIsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/notificacoes");
      if (response.ok) setItems(await response.json());
    } catch {
      // Sem conexão: mantém a última lista.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    window.addEventListener("dashboard:refresh", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("dashboard:refresh", load);
    };
  }, [load]);

  useEffect(() => setIsOpen(false), [pathname]);

  function persist(next) {
    // Guarda só os ids que ainda existem (a lista não cresce para sempre).
    const current = new Set(items.map((item) => item.id));
    const kept = [...next].filter((id) => current.has(id));
    setSeen(new Set(kept));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    } catch {
      // Sem armazenamento local: vale só nesta aba.
    }
  }

  const unread = items.filter((item) => !seen.has(item.id));

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={unread.length ? `Notificações: ${unread.length} novas` : "Notificações"}
        title="Notificações"
        className="relative grid size-10 place-items-center rounded-md text-marinho-900 transition-colors hover:bg-marinho-50"
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-destaque px-1 text-[10px] font-extrabold leading-[1.1rem] text-white">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button type="button" aria-label="Fechar notificações" onClick={() => setIsOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <section role="dialog" aria-label="Notificações" className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-extrabold text-marinho-900">Notificações</h2>
              {unread.length > 0 && (
                <button type="button" onClick={() => persist(new Set(items.map((item) => item.id)))} className="inline-flex items-center gap-1 text-xs font-bold text-marinho-700 hover:underline">
                  <CheckCheck size={14} /> Marcar todas como lidas
                </button>
              )}
            </header>
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Tudo em dia por aqui.</p>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {items.map((item) => {
                  const isNew = !seen.has(item.id);
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.link}
                        onClick={() => persist(new Set([...seen, item.id]))}
                        className={`flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${isNew ? "" : "opacity-60"}`}
                      >
                        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${isNew ? dotStyles[item.gravidade] : "bg-slate-300"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-marinho-900">{item.titulo}</span>
                          <span className="block truncate text-xs text-slate-500">{item.descricao}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">{when(item.quando)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
