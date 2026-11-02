import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Copy, Link2, Mail, MessageCircle } from "lucide-react";
import Modal from "./Modal.jsx";
import { apiJson } from "../api.js";
import { whatsappLink } from "../text.js";
import { buttonSecondary, inputBase } from "../ui.js";
import { confirmationLink, fillTemplate, templateValues } from "../mensagens.js";

// "Mensagem com modelo": escolhe um modelo (Configurações → Modelos), mostra o texto preenchido (editável) e abre o
// WhatsApp/e-mail ou copia. Opcional: os botões de WhatsApp de sempre continuam onde estavam.
export default function MessageTemplateDialog({ applicationId, onClose }) {
  const [templates, setTemplates] = useState(null);
  const [context, setContext] = useState(null);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!applicationId) return;
    Promise.all([
      apiJson("/modelos", undefined, "Não foi possível carregar os modelos."),
      apiJson(`/modelos/contexto/${applicationId}`, undefined, "Não foi possível carregar a candidatura."),
    ])
      .then(([list, data]) => {
        setTemplates(list);
        setContext(data);
        if (list[0]) {
          setSelected(list[0].id);
          setText(fillTemplate(list[0].texto, templateValues(data)));
        }
      })
      .catch((loadError) => setError(loadError.message));
  }, [applicationId]);

  const values = useMemo(() => (context ? templateValues(context) : null), [context]);

  function choose(id) {
    setSelected(id);
    const template = templates.find((item) => item.id === id);
    if (template && values) setText(fillTemplate(template.texto, values));
  }

  const whatsapp = context && whatsappLink(context.estudante.telefone, text);
  const link = context && confirmationLink(context.token_confirmacao);

  return (
    <Modal isOpen={Boolean(applicationId)} title="Mensagem com modelo" onClose={onClose}>
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : !templates || !context ? (
        <div className="h-40 animate-pulse rounded bg-slate-100" />
      ) : templates.length === 0 ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>Ainda não há modelos de mensagem.</p>
          <Link to="/configuracoes" onClick={onClose} className="font-semibold text-marinho-700 underline">Criar um modelo em Configurações</Link>
          {link && (
            <p className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
              <Link2 size={14} /> Link de confirmação:
              <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado."))} className="font-semibold text-marinho-700 underline">copiar</button>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Para <strong className="text-marinho-900">{context.estudante.nome_completo}</strong> · {context.vaga.titulo}</p>
          <label className="block text-sm font-semibold text-slate-700">
            Modelo
            <select value={selected} onChange={(e) => choose(e.target.value)} className={`${inputBase} mt-1 h-10`}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.titulo}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mensagem (pode editar antes de enviar)
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className={`${inputBase} mt-1 py-2`} />
          </label>
          {!context.token_confirmacao && /\{link_confirmacao\}/.test(templates.find((t) => t.id === selected)?.texto ?? "") && (
            <p className="text-xs text-amber-700">Sem entrevista futura marcada: o link de confirmação ficou vazio.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success("Mensagem copiada."))} className={buttonSecondary}>
              <Copy size={15} /> Copiar
            </button>
            {context.estudante.email && (
              <a href={`mailto:${context.estudante.email}?${new URLSearchParams({ subject: `Super Estágios · ${context.vaga.titulo}`, body: text }).toString().replace(/\+/g, "%20")}`} className={buttonSecondary}>
                <Mail size={15} /> E-mail
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
