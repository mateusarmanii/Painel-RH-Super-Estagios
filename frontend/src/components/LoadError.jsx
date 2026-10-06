import { RefreshCw, WifiOff } from "lucide-react";
import EmptyState from "./EmptyState.jsx";
import { buttonPrimary } from "../ui.js";

// Erro ao carregar uma tela: explica no lugar do conteúdo (em vez de parecer "vazio") e oferece tentar de novo.
export default function LoadError({ title, message, onRetry }) {
  return (
    <EmptyState icon={WifiOff} title={title} description={message}>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${buttonPrimary} mt-5`}>
          <RefreshCw size={16} /> Tentar novamente
        </button>
      )}
    </EmptyState>
  );
}
