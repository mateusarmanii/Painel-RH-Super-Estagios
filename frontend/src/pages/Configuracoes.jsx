import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Copy, ExternalLink, History, MessageSquareText, Pencil, Plus, Send, Settings2, Smartphone, Trash2, Unplug, UserCog } from "lucide-react";
import Modal from "../components/Modal.jsx";
import LoadError from "../components/LoadError.jsx";
import { apiJson } from "../api.js";
import { buttonPrimary, buttonSecondary, card, inputBase } from "../ui.js";
import { TEMPLATE_VARIABLES } from "../mensagens.js";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function Section({ title, description, children, action }) {
  return (
    <section className={`${card} p-5`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-marinho-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ambar-400 ${checked ? "bg-emerald-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-marinho-900">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

// ---------- Geral ----------

function GeneralTab({ isAdmin }) {
  const [settings, setSettings] = useState(null);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiJson("/configuracoes", undefined, "Não foi possível carregar as configurações.")
      .then((result) => {
        setSettings(result);
        setGoal(result.meta_contratacoes_mensal ?? "");
        setError("");
      })
      .catch((loadError) => setError(loadError.message));
  }, []);
  useEffect(load, [load]);

  async function save(changes, message) {
    try {
      const result = await apiJson("/configuracoes", { method: "PUT", body: changes }, "Não foi possível salvar.");
      setSettings(result);
      setGoal(result.meta_contratacoes_mensal ?? "");
      toast.success(message);
    } catch (saveError) {
      toast.error(saveError.message);
    }
  }

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!settings) return <div className={`${card} h-48 animate-pulse`} />;

  const publicLink = `${window.location.origin}/cadastro`;

  return (
    <div className="space-y-4">
      {!isAdmin && <p className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">Só administradores podem mudar estas configurações.</p>}
      <Section title="Meta mensal de contratações" description="Opcional. Aparece como barra de progresso no Dashboard.">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save({ meta_contratacoes_mensal: goal === "" ? null : Number(goal) }, goal === "" ? "Meta removida." : "Meta salva.");
          }}
        >
          <label className="text-sm font-semibold text-slate-700">
            Contratações por mês
            <input type="number" min="1" max="10000" step="1" value={goal} disabled={!isAdmin} onChange={(e) => setGoal(e.target.value)} placeholder="Sem meta" className={`${inputBase} mt-1 h-10 w-40`} />
          </label>
          <button type="submit" disabled={!isAdmin} className={buttonPrimary}>Salvar</button>
        </form>
      </Section>

      <Section title="Cadastro pelo site" description="Página pública com as vagas abertas e um formulário de cadastro (com aceite da LGPD). Começa desligada.">
        <div className="space-y-4">
          <Toggle
            checked={settings.formulario_publico_ativo}
            disabled={!isAdmin}
            onChange={(value) => save({ formulario_publico_ativo: value }, value ? "Cadastro pelo site ligado." : "Cadastro pelo site desligado.")}
            label="Página pública de vagas e cadastro"
            description="Os cadastros entram em Estudantes com a etiqueta “Site”; se o estudante escolher uma vaga, ele aparece no Kanban em Candidato Contatado."
          />
          <Toggle
            checked={settings.vagas_publicas_mostrar_empresa}
            disabled={!isAdmin || !settings.formulario_publico_ativo}
            onChange={(value) => save({ vagas_publicas_mostrar_empresa: value }, "Configuração salva.")}
            label="Mostrar o nome da empresa nas vagas públicas"
            description="Desligado, a página mostra só o título, a área e o local."
          />
          {settings.formulario_publico_ativo && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{publicLink}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(publicLink).then(() => toast.success("Link copiado."))} className={`${buttonSecondary} h-8 px-3 text-xs`}>
                <Copy size={14} /> Copiar
              </button>
              <a href={publicLink} target="_blank" rel="noopener noreferrer" className={`${buttonSecondary} h-8 px-3 text-xs`}>
                <ExternalLink size={14} /> Abrir
              </a>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ---------- Modelos de mensagem ----------

function TemplateForm({ initial, onSaved }) {
  const [title, setTitle] = useState(initial?.titulo ?? "");
  const [text, setText] = useState(initial?.texto ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await apiJson(initial ? `/modelos/${initial.id}` : "/modelos", { method: initial ? "PUT" : "POST", body: { titulo: title, texto: text } }, "Não foi possível salvar o modelo.");
      toast.success("Modelo salvo.");
      onSaved(saved);
    } catch (saveError) {
      toast.error(saveError.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Título
        <input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Convite para entrevista" className={`${inputBase} mt-1 h-10`} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Texto
        <textarea required rows={7} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={`${inputBase} mt-1 py-2`} />
      </label>
      <div>
        <p className="mb-1.5 text-xs text-slate-500">Variáveis (clique para inserir):</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((variable) => (
            <button key={variable.key} type="button" title={variable.label} onClick={() => setText((current) => `${current}{${variable.key}}`)} className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-50">
              {`{${variable.key}}`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={buttonPrimary}>{busy ? "Salvando..." : "Salvar modelo"}</button>
      </div>
    </form>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState(null);
  const [editing, setEditing] = useState(null); // null | "novo" | modelo
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiJson("/modelos", undefined, "Não foi possível carregar os modelos.").then(setTemplates).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function remove(template) {
    if (!window.confirm(`Excluir o modelo “${template.titulo}”?`)) return;
    try {
      await apiJson(`/modelos/${template.id}`, { method: "DELETE" }, "Não foi possível excluir.");
      setTemplates((list) => list.filter((item) => item.id !== template.id));
      toast.success("Modelo excluído.");
    } catch (removeError) {
      toast.error(removeError.message);
    }
  }

  if (error) return <LoadError message={error} onRetry={load} />;

  return (
    <Section
      title="Modelos de mensagem"
      description="Opcional. Textos prontos para WhatsApp ou e-mail, preenchidos com o nome, a vaga e a entrevista. Use no Kanban e no perfil do estudante (“Mensagem com modelo”)."
      action={<button type="button" onClick={() => setEditing("novo")} className={buttonPrimary}><Plus size={16} /> Novo modelo</button>}
    >
      {!templates ? (
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      ) : templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Nenhum modelo ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {templates.map((template) => (
            <li key={template.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-marinho-900">{template.titulo}</p>
                <p className="line-clamp-2 whitespace-pre-line text-xs text-slate-500">{template.texto}</p>
              </div>
              <button type="button" onClick={() => setEditing(template)} title="Editar" aria-label={`Editar ${template.titulo}`} className="grid size-8 place-items-center rounded-md text-marinho-700 hover:bg-marinho-50"><Pencil size={15} /></button>
              <button type="button" onClick={() => remove(template)} title="Excluir" aria-label={`Excluir ${template.titulo}`} className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal isOpen={Boolean(editing)} title={editing === "novo" ? "Novo modelo" : "Editar modelo"} onClose={() => setEditing(null)}>
        {editing && (
          <TemplateForm
            key={editing === "novo" ? "novo" : editing.id}
            initial={editing === "novo" ? null : editing}
            onSaved={(saved) => {
              setTemplates((list) => [...(list ?? []).filter((item) => item.id !== saved.id), saved].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Section>
  );
}

// ---------- Usuários (ADMIN) ----------

const roleLabels = { ADMIN: "Administrador", RECRUTADOR: "Recrutador" };

function UserForm({ initial, onSaved }) {
  const [form, setForm] = useState({ nome: initial?.nome ?? "", email: initial?.email ?? "", papel: initial?.papel ?? "RECRUTADOR", senha: "" });
  const [busy, setBusy] = useState(false);
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = initial ? { nome: form.nome, papel: form.papel, ...(form.senha && { senha: form.senha }) } : form;
      const saved = await apiJson(initial ? `/usuarios/${initial.id}` : "/usuarios", { method: initial ? "PATCH" : "POST", body }, "Não foi possível salvar o usuário.");
      toast.success(initial ? "Usuário atualizado." : "Usuário criado.");
      onSaved(saved);
    } catch (saveError) {
      toast.error(saveError.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">Nome<input required value={form.nome} onChange={set("nome")} className={`${inputBase} mt-1 h-10`} /></label>
      <label className="block text-sm font-semibold text-slate-700">E-mail<input required={!initial} disabled={Boolean(initial)} type="email" value={form.email} onChange={set("email")} className={`${inputBase} mt-1 h-10`} /></label>
      <label className="block text-sm font-semibold text-slate-700">
        Papel
        <select value={form.papel} onChange={set("papel")} className={`${inputBase} mt-1 h-10`}>
          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        {initial ? "Nova senha (opcional)" : "Senha"}
        <input type="password" autoComplete="new-password" required={!initial} minLength={10} value={form.senha} onChange={set("senha")} className={`${inputBase} mt-1 h-10`} />
        <span className="text-xs font-normal text-slate-500">Mínimo de 10 caracteres.</span>
      </label>
      <div className="flex justify-end"><button type="submit" disabled={busy} className={buttonPrimary}>{busy ? "Salvando..." : "Salvar"}</button></div>
    </form>
  );
}

function UsersTab({ user }) {
  const [users, setUsers] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiJson("/usuarios", undefined, "Não foi possível carregar os usuários.").then(setUsers).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function toggleActive(target) {
    try {
      const saved = await apiJson(`/usuarios/${target.id}`, { method: "PATCH", body: { ativo: !target.ativo } }, "Não foi possível atualizar.");
      setUsers((list) => list.map((item) => (item.id === saved.id ? saved : item)));
      toast.success(saved.ativo ? "Usuário reativado." : "Usuário desativado.");
    } catch (toggleError) {
      toast.error(toggleError.message);
    }
  }

  if (error) return <LoadError message={error} onRetry={load} />;

  return (
    <Section
      title="Usuários"
      description="Quem entra no painel. Desativar bloqueia o acesso na hora, sem apagar o histórico."
      action={<button type="button" onClick={() => setEditing("novo")} className={buttonPrimary}><Plus size={16} /> Novo usuário</button>}
    >
      {!users ? (
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {users.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-bold text-marinho-900">{item.nome}{item.id === user.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(você)</span>}</p>
                <p className="truncate text-xs text-slate-500">{item.email}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{roleLabels[item.papel]}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.ativo ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{item.ativo ? "Ativo" : "Desativado"}</span>
              <button type="button" onClick={() => setEditing(item)} className={`${buttonSecondary} h-8 px-3 text-xs`}>Editar</button>
              {item.id !== user.id && (
                <button type="button" onClick={() => toggleActive(item)} className={`${buttonSecondary} h-8 px-3 text-xs`}>{item.ativo ? "Desativar" : "Reativar"}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal isOpen={Boolean(editing)} title={editing === "novo" ? "Novo usuário" : "Editar usuário"} onClose={() => setEditing(null)}>
        {editing && (
          <UserForm
            initial={editing === "novo" ? null : editing}
            onSaved={(saved) => {
              setUsers((list) => [...(list ?? []).filter((item) => item.id !== saved.id), saved].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Section>
  );
}

// ---------- Registro de atividades (ADMIN) ----------

const methodLabels = { POST: "Criou", PUT: "Editou", PATCH: "Alterou", DELETE: "Excluiu" };
const entityLabels = {
  candidatos: "estudante/candidatura", vagas: "vaga", empresas: "empresa", entrevistas: "entrevista", eventos: "evento",
  lembretes: "lembrete", estagios: "estágio", contatos: "contato", modelos: "modelo de mensagem", usuarios: "usuário", configuracoes: "configurações",
};

function ActivityTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    apiJson("/atividades?limite=300", undefined, "Não foi possível carregar o registro.").then(setItems).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  if (error) return <LoadError message={error} onRetry={load} />;
  return (
    <Section title="Registro de atividades" description="Cada alteração feita no painel: quem fez, o quê e quando (as 300 mais recentes). Gravado automaticamente.">
      {!items ? (
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Nenhuma atividade registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Quem</th><th className="px-3 py-2">O quê</th><th className="px-3 py-2">Caminho</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{dateTime.format(new Date(item.created_at))}</td>
                  <td className="px-3 py-2 font-semibold text-marinho-900">{item.usuario?.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{methodLabels[item.metodo] ?? item.metodo} {entityLabels[item.entidade] ?? item.entidade ?? ""}</td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-slate-500" title={item.caminho}>{item.caminho}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Celular (Telegram) ----------

function PhoneTab() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { link, expira_em } enquanto espera o "Iniciar" no Telegram
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiJson("/telegram", undefined, "Não foi possível carregar.")
      .then((result) => {
        setStatus(result);
        setError("");
        if (result.conectado) setPending(null);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);
  useEffect(load, [load]);

  // Enquanto o link está aberto, confere a cada 3 s se a conexão foi feita (até o código vencer).
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => {
      if (new Date(pending.expira_em) < new Date()) {
        setPending(null);
        return;
      }
      apiJson("/telegram", undefined, "").then((result) => {
        if (result.conectado) {
          setStatus(result);
          setPending(null);
          toast.success("Telegram conectado.");
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [pending]);

  async function run(action) {
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      toast.error(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  const connect = () => run(async () => {
    const result = await apiJson("/telegram/conectar", { method: "POST" }, "Não foi possível gerar o link.");
    setPending(result);
    window.open(result.link, "_blank", "noopener,noreferrer");
  });
  const sendTest = () => run(async () => {
    await apiJson("/telegram/teste", { method: "POST" }, "Não foi possível enviar o teste.");
    toast.success("Mensagem de teste enviada.");
  });
  const disconnect = () => run(async () => {
    await apiJson("/telegram", { method: "DELETE" }, "Não foi possível desconectar.");
    toast.success("Telegram desconectado.");
    load();
  });

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!status) return <div className={`${card} h-48 animate-pulse`} />;

  return (
    <div className="space-y-4">
      <Section
        title="Avisos no celular pelo Telegram"
        description="Opcional e individual: cada pessoa conecta o próprio Telegram. Tudo que aparece no sino chega também como mensagem, assim que surge. Entre 22h e 7h as mensagens chegam sem som."
      >
        {!status.configurado ? (
          <div className="space-y-2 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-marinho-900">O Telegram ainda não foi ligado no servidor.</p>
            <p>
              Quem administra o sistema cria um bot no Telegram com o <span className="font-mono">@BotFather</span> (comando <span className="font-mono">/newbot</span>)
              e coloca o token na variável <span className="font-mono">TELEGRAM_BOT_TOKEN</span> da API. Depois disso, este botão fica disponível.
            </p>
          </div>
        ) : status.conectado ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={18} /> Conectado{status.conectado_em ? ` desde ${dateTime.format(new Date(status.conectado_em))}` : ""}
              {status.bot && <span className="font-normal text-emerald-700">· bot @{status.bot}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={sendTest} className={buttonSecondary}><Send size={16} /> Enviar teste</button>
              <button type="button" disabled={busy} onClick={disconnect} className={buttonSecondary}><Unplug size={16} /> Desconectar</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Toque em <b>Conectar Telegram</b> (de preferência no celular, com o Telegram instalado).</li>
              <li>No Telegram, toque em <b>Iniciar</b>. Pronto: a confirmação chega lá e aqui.</li>
            </ol>
            <button type="button" disabled={busy} onClick={connect} className={buttonPrimary}><Smartphone size={16} /> Conectar Telegram</button>
            {pending && (
              <div className="space-y-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Aguardando você tocar em “Iniciar” no Telegram…</p>
                <p>
                  Se o Telegram não abriu, use este link (vale 15 minutos):{" "}
                  <a href={pending.link} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline">{pending.link}</a>
                </p>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

export default function ConfiguracoesPage({ user }) {
  const isAdmin = user?.papel === "ADMIN";
  const tabs = [
    { value: "geral", label: "Geral", icon: Settings2 },
    { value: "modelos", label: "Modelos de mensagem", icon: MessageSquareText },
    { value: "celular", label: "Celular", icon: Smartphone },
    ...(isAdmin ? [{ value: "usuarios", label: "Usuários", icon: UserCog }, { value: "atividades", label: "Atividades", icon: History }] : []),
  ];
  const [tab, setTab] = useState("geral");

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div role="tablist" aria-label="Configurações" className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === value ? "border-ambar-400 text-marinho-900" : "border-transparent text-slate-500 hover:text-marinho-900"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        {tab === "geral" && <GeneralTab isAdmin={isAdmin} />}
        {tab === "modelos" && <TemplatesTab />}
        {tab === "celular" && <PhoneTab />}
        {tab === "usuarios" && isAdmin && <UsersTab user={user} />}
        {tab === "atividades" && isAdmin && <ActivityTab />}
      </div>
    </section>
  );
}
