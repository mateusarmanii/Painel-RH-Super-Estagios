import { X } from "lucide-react";

export default function Modal({ isOpen, title, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-marinho-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="my-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 bg-ambar-400 px-5 py-3 text-marinho-900">
          <h2 id="modal-title" className="text-sm font-extrabold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar janela"
            title="Fechar janela"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-md text-marinho-900 transition-colors hover:bg-ambar-500"
          >
            <X size={19} />
          </button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
