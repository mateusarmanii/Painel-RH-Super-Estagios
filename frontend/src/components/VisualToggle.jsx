import { Droplets, Moon, Square, Sun } from "lucide-react";
import { trocarModoGlass, trocarVisual, useModoGlass, useVisual } from "../visual.js";

// Botão Clássico ↔ Liquid Glass. O texto diz para qual visual o clique leva; iconOnly deixa só o ícone (celular).
export function VisualToggle({ className, labelClassName, iconOnly = false }) {
  const emGlass = useVisual() === "glass";
  const Icon = emGlass ? Square : Droplets;
  const nome = emGlass ? "Visual clássico" : "Liquid Glass";
  return (
    <button
      type="button"
      onClick={() => trocarVisual(emGlass ? "classico" : "glass")}
      title={`Mudar para: ${nome}`}
      aria-label={`Mudar para: ${nome}`}
      className={className}
    >
      <Icon size={17} className="shrink-0" />
      {!iconOnly && <span className={labelClassName}>{nome}</span>}
    </button>
  );
}

// Modo do Liquid Glass: Claro ou Escuro. Só aparece com o Liquid Glass ligado.
export function GlassModeToggle({ className = "" }) {
  const visual = useVisual();
  const modo = useModoGlass();
  if (visual !== "glass") return null;
  return (
    <div role="group" aria-label="Modo do Liquid Glass" className={`flex gap-1 px-3 pb-1 ${className}`}>
      {[["claro", "Claro", Sun], ["escuro", "Escuro", Moon]].map(([valor, rotulo, Icon]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={modo === valor}
          onClick={() => trocarModoGlass(valor)}
          className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${modo === valor ? "bg-ambar-400 text-marinho-900" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}
        >
          <Icon size={12} /> {rotulo}
        </button>
      ))}
    </div>
  );
}
