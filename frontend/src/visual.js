// Visual do painel: Clássico (padrão) ou Liquid Glass. A escolha fica no navegador e vale também para o login.
// O index.html aplica o atributo antes de a página aparecer, para não piscar o visual errado.
// O Liquid Glass tem dois modos fixos, Claro e Escuro, também salvos no navegador.
import { useSyncExternalStore } from "react";

const CHAVE_VISUAL = "visual";
const CHAVE_MODO = "visualVariacao";
const raiz = document.documentElement;
const ouvintes = new Set();

function guardar(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Sem acesso ao armazenamento local: vale até fechar a página.
  }
}

function aplicar(atributo, valor, chave) {
  raiz.setAttribute(atributo, valor);
  guardar(chave, valor);
  ouvintes.forEach((avisar) => avisar());
}

export const trocarVisual = (visual) => aplicar("data-visual", visual, CHAVE_VISUAL);
export const trocarModoGlass = (modo) => aplicar("data-glass", modo, CHAVE_MODO);

function assinar(avisar) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export const useVisual = () => useSyncExternalStore(assinar, () => raiz.getAttribute("data-visual") ?? "classico");
export const useModoGlass = () => useSyncExternalStore(assinar, () => raiz.getAttribute("data-glass") ?? "claro");
