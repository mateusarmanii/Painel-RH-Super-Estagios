import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { API_URL as apiUrl } from "../api.js";

const endpoints = { empresa: "empresas", vaga: "vagas", estudante: "candidatos" };
const successMessages = {
  empresa: { create: "Empresa cadastrada com sucesso.", edit: "Empresa atualizada com sucesso." },
  vaga: { create: "Vaga cadastrada com sucesso.", edit: "Vaga atualizada com sucesso." },
  estudante: { create: "Estudante cadastrado com sucesso.", edit: "Estudante atualizado com sucesso." },
};

const fieldSets = {
  empresa: [
    { name: "nome", label: "Nome da empresa", placeholder: "Nome da empresa" },
    { name: "setor", label: "Setor", placeholder: "Ex.: Tecnologia" },
    { name: "nome_contato", label: "Nome do contato", placeholder: "Nome completo" },
    { name: "telefone_contato", label: "Telefone de contato", type: "tel", placeholder: "(00) 00000-0000" },
    { name: "email_contato", label: "E-mail de contato", type: "email", placeholder: "contato@empresa.com" },
  ],
  vaga: [
    { name: "titulo", label: "Título", placeholder: "Título da vaga" },
    { name: "codigo_vaga", label: "Código da vaga", placeholder: "6 dígitos", pattern: "[0-9]{6}", maxLength: 6 },
    { name: "descricao", label: "Descrição", type: "textarea", placeholder: "Descreva as responsabilidades" },
    { name: "valor", label: "Bolsa-auxílio", type: "number", placeholder: "0,00", min: "0", step: "0.01" },
    { name: "empresa_id", label: "Empresa", type: "select", optionsKey: "empresas" },
  ],
  estudante: [
    { name: "nome_completo", label: "Nome", placeholder: "Nome completo" },
    { name: "curso", label: "Curso", placeholder: "Curso do estudante" },
    { name: "email", label: "E-mail", type: "email", placeholder: "estudante@email.com", optional: true },
    { name: "telefone", label: "Telefone", type: "tel", placeholder: "(00) 00000-0000" },
    { name: "instituicao_ensino", label: "Instituição de ensino", placeholder: "Nome da instituição" },
    {
      name: "horario_estudo",
      label: "Horário de estudo",
      type: "select",
      options: [
        { id: "MANHA", label: "Manhã" },
        { id: "TARDE", label: "Tarde" },
        { id: "NOITE", label: "Noite" },
      ],
    },
    // A vaga só é escolhida no cadastro; depois, as candidaturas são geridas pelo Kanban.
    { name: "vaga_id", label: "Vaga", type: "select", optionsKey: "vagas", createOnly: true },
    {
      name: "anotacoes_recrutador",
      label: "Anotações do Recrutador",
      type: "textarea",
      rows: 5,
      optional: true,
      placeholder: "Impressões da entrevista, pontos fortes, disponibilidade...",
    },
  ],
};

function initialFormState(type, initialData) {
  if (!initialData) return { horario_estudo: "NOITE" };

  return Object.fromEntries(
    fieldSets[type]
      .filter((field) => !field.createOnly)
      .map((field) => [field.name, initialData[field.name] == null ? "" : String(initialData[field.name])]),
  );
}

export default function CreationForm({ type, initialData, onSuccess }) {
  const isEditing = Boolean(initialData);
  const fields = fieldSets[type].filter((field) => !(isEditing && field.createOnly));
  const [form, setForm] = useState(() => initialFormState(type, initialData));
  const [options, setOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const optionKey = fields.find((field) => field.optionsKey)?.optionsKey;
  const optionType = optionKey ?? null;

  useEffect(() => {
    if (!optionType) return undefined;

    let isCurrent = true;
    setIsLoadingOptions(true);

    fetch(`${apiUrl}/${optionType}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as opções.");
        return response.json();
      })
      .then((items) => {
        if (!isCurrent) return;
        setOptions(
          optionType === "vagas" ? items.filter((item) => item.status === "ABERTA") : items,
        );
      })
      .catch((loadError) => {
        if (isCurrent) toast.error(loadError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingOptions(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [optionType]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = Object.fromEntries(
      fields.map((field) => {
        const value = form[field.name] ?? "";
        if (field.name === "valor") return [field.name, Number(value)];
        if (field.optional && value.trim() === "") return [field.name, null];
        return [field.name, value];
      }),
    );

    try {
      const response = await fetch(
        `${apiUrl}/${endpoints[type]}${isEditing ? `/${initialData.id}` : ""}`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível salvar o cadastro.");

      toast.success(successMessages[type][isEditing ? "edit" : "create"]);
      // Avisa o Dashboard e as listas para recarregarem.
      window.dispatchEvent(new Event("dashboard:refresh"));
      onSuccess();
    } catch (submitError) {
      toast.error(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => {
        const commonProps = {
          id: `${type}-${field.name}`,
          name: field.name,
          value: form[field.name] ?? "",
          onChange: updateField,
          required: !field.optional,
          className: "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15",
        };

        return (
          <label key={field.name} htmlFor={commonProps.id} className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              {field.label}
              {field.optional && <span className="font-normal text-slate-400"> (opcional)</span>}
            </span>
            {field.type === "textarea" ? (
              <textarea
                {...commonProps}
                rows={field.rows ?? 3}
                placeholder={field.placeholder}
                className={`${commonProps.className} h-auto resize-y py-2`}
              />
            ) : field.type === "select" ? (
              <select {...commonProps}>
                <option value="">
                  {isLoadingOptions && field.optionsKey
                    ? "A carregar..."
                    : options.length === 0 && field.optionsKey === "empresas"
                      ? "Cadastre uma empresa primeiro"
                      : options.length === 0 && field.optionsKey === "vagas"
                        ? "Nenhuma vaga aberta disponível"
                        : "Selecione uma opção"}
                </option>
                {(field.options ?? options.map((item) => ({
                  id: item.id,
                  label: field.optionsKey === "empresas" ? item.nome : `${item.codigo_vaga} - ${item.titulo}`,
                }))).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...commonProps}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                pattern={field.pattern}
                maxLength={field.maxLength}
                min={field.min}
                step={field.step}
              />
            )}
          </label>
        );
      })}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting || (optionType !== null && isLoadingOptions) || (optionType !== null && options.length === 0)}
          className="h-10 rounded-md bg-sky-800 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}