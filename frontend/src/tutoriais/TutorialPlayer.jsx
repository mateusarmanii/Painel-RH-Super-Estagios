// Tocador dos tutoriais "Como usar": mostra uma mini-tela por passo, leva um cursor até o elemento marcado com <Alvo>
// e avança sozinho. As telas são desenhos com dados fictícios (src/tutoriais/roteiros.jsx); nada aqui mexe em dados.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MousePointer2, Pause, Play, RotateCcw } from "lucide-react";
import { buttonSecondary } from "../ui.js";

const AlvoAtual = createContext({ alvo: null, clicado: false });
const TEMPO_DO_CURSOR_MS = 800;

// Tempo para ler a legenda com calma, somado ao movimento do cursor.
const duracaoDoPasso = (passo) => Math.max(3000, passo.legenda.length * 60) + TEMPO_DO_CURSOR_MS;

// Marca um elemento da mini-tela que o cursor pode apontar.
export function Alvo({ id, className = "", children }) {
  const { alvo, clicado } = useContext(AlvoAtual);
  const ativo = Boolean(id) && id === alvo;
  return (
    <div data-alvo={id} className={`rounded-md transition-shadow duration-200 ${className} ${ativo && clicado ? "ring-2 ring-ambar-400 ring-offset-1" : ""}`}>
      {children}
    </div>
  );
}

export default function TutorialPlayer({ passos }) {
  const reduzirMovimento = useRef(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(!reduzirMovimento.current);
  const [cursor, setCursor] = useState(null);
  const [clicado, setClicado] = useState(false);
  const palco = useRef(null);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  // Leva o cursor até o alvo deste passo e, ao chegar, marca o clique.
  useLayoutEffect(() => {
    setClicado(false);
    const elemento = passo.alvo && palco.current?.querySelector(`[data-alvo="${passo.alvo}"]`);
    if (!elemento) {
      setCursor(null);
      return undefined;
    }
    const caixa = elemento.getBoundingClientRect();
    const origem = palco.current.getBoundingClientRect();
    setCursor({ x: caixa.left - origem.left + caixa.width / 2, y: caixa.top - origem.top + caixa.height / 2 });
    const espera = setTimeout(() => setClicado(true), TEMPO_DO_CURSOR_MS);
    return () => clearTimeout(espera);
  }, [passo]);

  useEffect(() => {
    if (!tocando) return undefined;
    const espera = setTimeout(() => {
      if (ultimo) setTocando(false);
      else setIndice((atual) => atual + 1);
    }, duracaoDoPasso(passo));
    return () => clearTimeout(espera);
  }, [tocando, passo, ultimo]);

  const irPara = (novo) => setIndice(Math.min(Math.max(novo, 0), passos.length - 1));
  const verDeNovo = () => {
    setIndice(0);
    setTocando(true);
  };
  const terminou = ultimo && !tocando;

  return (
    <div className="space-y-3">
      <div ref={palco} aria-hidden="true" className="relative h-64 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-snug text-slate-800 sm:h-72 sm:p-3">
        <AlvoAtual.Provider value={{ alvo: passo.alvo, clicado }}>{passo.tela}</AlvoAtual.Provider>
        {cursor && (
          <div
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
            className="pointer-events-none absolute left-0 top-0 z-10 transition-transform duration-700 ease-in-out motion-reduce:transition-none"
          >
            {clicado && <span className="absolute -left-3 -top-3 size-6 animate-ping rounded-full bg-ambar-400/60 motion-reduce:hidden" />}
            <MousePointer2 size={20} className="fill-marinho-900 text-white drop-shadow" />
          </div>
        )}
      </div>

      <p aria-live="polite" className="min-h-[3.75rem] text-sm font-semibold text-marinho-900">{passo.legenda}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {passos.map((item, posicao) => (
            <span key={item.legenda} className={`size-2 rounded-full ${posicao === indice ? "bg-ambar-400" : posicao < indice ? "bg-marinho-700" : "bg-slate-200"}`} />
          ))}
          <span className="ml-1 text-xs text-slate-500">{indice + 1} de {passos.length}</span>
        </div>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Passo anterior" title="Passo anterior" disabled={indice === 0} onClick={() => irPara(indice - 1)} className={`${buttonSecondary} h-9 px-2.5`}>
            <ChevronLeft size={16} />
          </button>
          {terminou ? (
            <button type="button" onClick={verDeNovo} className={`${buttonSecondary} h-9 px-3 text-xs`}><RotateCcw size={15} /> Ver de novo</button>
          ) : (
            <button type="button" onClick={() => setTocando((atual) => !atual)} className={`${buttonSecondary} h-9 px-3 text-xs`}>
              {tocando ? <Pause size={15} /> : <Play size={15} />} {tocando ? "Pausar" : "Continuar"}
            </button>
          )}
          <button type="button" aria-label="Próximo passo" title="Próximo passo" disabled={ultimo} onClick={() => irPara(indice + 1)} className={`${buttonSecondary} h-9 px-2.5`}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
