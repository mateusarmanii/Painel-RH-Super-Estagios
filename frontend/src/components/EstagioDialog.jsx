import { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "./Modal.jsx";
import { apiJson } from "../api.js";
import { buttonPrimary, inputBase } from "../ui.js";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const toInput = (value) => (value ? String(value).slice(0, 10) : "");

// Alertas do estágio (calculados na API): contrato terminando, limite de 2 anos, TCE, relatórios.
export function EstagioBadges({ estagio, compact = false }) {
  const alerts = estagio?.situacao?.alertas ?? [];
  if (!estagio) return compact ? <span className="text-xs text-slate-400">Sem dados do estágio</span> : null;
  if (!alerts.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={12} /> {estagio.encerrado_em ? "Estágio encerrado" : "Estágio em dia"}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {(compact ? alerts.slice(0, 2) : alerts).map((alert) => (
        <span key={alert.tipo} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${alert.gravidade === "alta" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>
          <AlertTriangle size={11} /> {alert.texto}
        </span>
      ))}
      {compact && alerts.length > 2 && <span className="text-[11px] text-slate-500">+{alerts.length - 2}</span>}
    </span>
  );
}

// Dados do estágio depois da contratação. Tudo opcional: dá para salvar só o que souber.
export default function EstagioDialog({ hire, estagio, onClose, onSaved }) {
  const [form, setForm] = useState({
    data_inicio: toInput(estagio?.data_inicio),
    data_fim: toInput(estagio?.data_fim),
    tce_assinado: estagio?.tce_assinado ?? false,
    seguro_apolice: estagio?.seguro_apolice ?? "",
    supervisor: estagio?.supervisor ?? "",
    taxa_agenciamento: estagio?.taxa_agenciamento ?? "",
    observacoes: estagio?.observacoes ?? "",
    encerrado_em: toInput(estagio?.encerrado_em),
  });
  const [current, setCurrent] = useState(estagio);
  const [busy, setBusy] = useState(false);
  const set = (name) => (event) => setForm((values) => ({ ...values, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, taxa_agenciamento: form.taxa_agenciamento === "" ? null : Number(form.taxa_agenciamento) };
      const saved = await apiJson(`/estagios/${hire.id}`, { method: "PUT", body }, "Não foi possível salvar os dados do estágio.");
      toast.success("Dados do estágio salvos.");
      onSaved(hire.id, saved);
      onClose();
    } catch (saveError) {
      toast.error(saveError.message);
      setBusy(false);
    }
  }

  async function toggleReport(numero, delivered) {
    try {
      const saved = delivered
        ? await apiJson(`/estagios/${hire.id}/relatorios/${numero}`, { method: "DELETE" }, "Não foi possível desfazer.")
        : await apiJson(`/estagios/${hire.id}/relatorios`, { method: "POST", body: { numero } }, "Não foi possível registrar o relatório.");
      setCurrent(saved);
      onSaved(hire.id, saved);
    } catch (reportError) {
      toast.error(reportError.message);
    }
  }

  const delivered = new Map((current?.relatorios ?? []).map((report) => [report.numero, report.entregue_em]));
  const reportCount = Math.max(current?.situacao?.relatoriosDevidos ?? 0, ...delivered.keys(), 0) + (form.data_inicio ? 1 : 0);

  return (
    <Modal isOpen title="Dados do estágio" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">
          <strong className="text-marinho-900">{hire.estudante.nome_completo}</strong> · {hire.vaga?.titulo} · {hire.vaga?.empresa?.nome}
        </p>
        <p className="text-xs text-slate-500">Todos os campos são opcionais. Com as datas, o painel avisa quando o contrato estiver acabando e quando vencer o limite de 2 anos.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-slate-700">Início do estágio<input type="date" value={form.data_inicio} onChange={set("data_inicio")} className={`${inputBase} mt-1 h-10`} /></label>
          <label className="text-sm font-semibold text-slate-700">Fim do contrato<input type="date" value={form.data_fim} min={form.data_inicio || undefined} onChange={set("data_fim")} className={`${inputBase} mt-1 h-10`} /></label>
          <label className="text-sm font-semibold text-slate-700">Supervisor na empresa<input maxLength={100} value={form.supervisor} onChange={set("supervisor")} className={`${inputBase} mt-1 h-10`} /></label>
          <label className="text-sm font-semibold text-slate-700">Apólice do seguro<input maxLength={100} value={form.seguro_apolice} onChange={set("seguro_apolice")} className={`${inputBase} mt-1 h-10`} /></label>
          <label className="text-sm font-semibold text-slate-700">Taxa de agenciamento (R$)<input type="number" min="0" step="0.01" value={form.taxa_agenciamento} onChange={set("taxa_agenciamento")} className={`${inputBase} mt-1 h-10`} /></label>
          <label className="text-sm font-semibold text-slate-700">Estágio encerrado em<input type="date" value={form.encerrado_em} onChange={set("encerrado_em")} className={`${inputBase} mt-1 h-10`} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={form.tce_assinado} onChange={set("tce_assinado")} className="size-4 accent-marinho-700" /> TCE (Termo de Compromisso) assinado
        </label>
        <label className="block text-sm font-semibold text-slate-700">Observações<textarea rows={3} maxLength={2000} value={form.observacoes} onChange={set("observacoes")} className={`${inputBase} mt-1 py-2`} /></label>

        {reportCount > 0 && current && (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-700">Relatórios semestrais de atividades</p>
            <ul className="flex flex-wrap gap-2">
              {Array.from({ length: reportCount }, (_, index) => index + 1).map((numero) => {
                const done = delivered.has(numero);
                const due = numero <= (current?.situacao?.relatoriosDevidos ?? 0);
                return (
                  <li key={numero}>
                    <label className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : due ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600"}`}>
                      <input type="checkbox" checked={done} onChange={() => toggleReport(numero, done)} className="accent-emerald-700" />
                      {numero}º semestre{done ? ` · ${dayFormat.format(new Date(delivered.get(numero)))}` : due ? " · pendente" : ""}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!current && form.data_inicio && <p className="text-xs text-slate-500">Salve uma vez para controlar os relatórios semestrais.</p>}

        <div className="flex justify-end"><button type="submit" disabled={busy} className={buttonPrimary}>{busy ? "Salvando..." : "Salvar"}</button></div>
      </form>
    </Modal>
  );
}
