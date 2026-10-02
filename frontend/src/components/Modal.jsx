import { X } from "lucide-react";

export default function Modal({ isOpen, title, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar janela"
            title="Fechar janela"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}