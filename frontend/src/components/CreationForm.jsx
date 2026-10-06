import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { API_URL as apiUrl } from "../api.js";
import LogoField, { saveLogoChange } from "./LogoField.jsx";
import { periodoLabels, toDateInput, toMonthInput, turnoEstudoLabels, turnoVagaLabels } from "../estudante.js";

const toOptions = (labels) => Object.entries(labels).map(([id, label]) => ({ id, label }));

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
    { name: "turno", label: "Turno", type: "select", options: toOptions(turnoVagaLabels), optional: true },
  ],
  estudante: [
    { name: "nome_completo", label: "Nome", placeholder: "Nome completo" },
    { name: "curso", label: "Curso", placeholder: "Curso do estudante" },
    { name: "email", label: "E-mail", type: "email", placeholder: "estudante@email.com", optional: true },
    { name: "telefone", label: "Telefone", type: "tel", placeholder: "(00) 00000-0000" },
    { name: "instituicao_ensino", label: "Instituição de ensino", placeholder: "Nome da instituição" },
    { name: "turno_estudo", label: "Turno de estudo", type: "select", options: toOptions(turnoEstudoLabels), optional: true, half: true },
    { name: "semestre_atual", label: "Semestre atual", type: "integer", min: "1", max: "12", placeholder: "Ex.: 5", optional: true, half: true },
    {
      name: "disponibilidade",
      label: "Disponibilidade para estagiar",
      type: "checkboxes",
      options: toOptions(periodoLabels),
      optional: true,
    },
    { name: "previsao_formatura", label: "Previsão de formatura", type: "month", optional: true, half: true },
    { name: "data_nascimento", label: "Data de nascimento", type: "date", optional: true, half: true },
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

// Valor do campo no formulário a partir do que veio da API.
function toFormValue(field, value) {
  if (field.type === "checkboxes") return value ?? [];
  if (value == null) return "";
  if (field.type === "month") return toMonthInput(value);
  if (field.type === "date") return toDateInput(value);
  return String(value);
}

// Valor enviado à API (opcional em branco vira null; o backend apaga o campo).
function toPayloadValue(field, value) {
  if (field.type === "checkboxes") return value ?? [];
  const text = value ?? "";
  if (field.name === "valor") return Number(text);
  if (field.optional && text.trim() === "") return null;
  if (field.type === "integer") return Number(text);
  return text;
}

function initialFormState(type, initialData) {
  const fields = fieldSets[type].filter((field) => !(initialData && field.createOnly));
  return Object.fromEntries(fields.map((field) => [field.name, toFormValue(field, initialData?.[field.name])]));
}

export default function CreationForm({ type, initialData, onSuccess }) {
  const isEditing = Boolean(initialData);
  const fields = fieldSets[type].filter((field) => !(isEditing && field.createOnly));
  const [form, setForm] = useState(() => initialFormState(type, initialData));
  const [options, setOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Logo da empresa: { file } para enviar/trocar, { remove: true } para apagar; enviada depois de salvar os dados.
  const [logoChange, setLogoChange] = useState(null);
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

  function toggleOption(name, option) {
    setForm((current) => {
      const selected = current[name] ?? [];
      return { ...current, [name]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = Object.fromEntries(fields.map((field) => [field.name, toPayloadValue(field, form[field.name])]));

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

      if (logoChange) {
        try {
          await saveLogoChange(result.id, logoChange);
        } catch (logoError) {
          toast.error(`Os dados foram salvos, mas a logo não: ${logoError.message}`);
        }
      }

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
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {type === "empresa" && (
        <LogoField
          empresaId={initialData?.id}
          name={form.nome}
          currentLogoUrl={initialData?.logo_url}
          change={logoChange}
          onChange={setLogoChange}
        />
      )}
      {fields.map((field) => {
        const commonProps = {
          id: `${type}-${field.name}`,
          name: field.name,
          value: form[field.name] ?? "",
          onChange: updateField,
          required: !field.optional,
          className: "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40",
        };
        const labelText = (
          <span className="text-sm font-medium text-slate-700">
            {field.label}
            {field.optional && <span className="font-normal text-slate-400"> (opcional)</span>}
          </span>
        );
        const span = field.half ? "" : "sm:col-span-2";

        if (field.type === "checkboxes") {
          const selected = form[field.name] ?? [];
          return (
            <fieldset key={field.name} className={`space-y-1.5 ${span}`}>
              <legend className="mb-1.5">{labelText}</legend>
              <div className="flex flex-wrap gap-2">
                {field.options.map((option) => {
                  const checked = selected.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ambar-400/60 ${
                        checked ? "border-marinho-700 bg-marinho-50 text-marinho-900" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name={field.name}
                        value={option.id}
                        checked={checked}
                        onChange={() => toggleOption(field.name, option.id)}
                        className="size-4 accent-marinho-800"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        return (
          <label key={field.name} htmlFor={commonProps.id} className={`block space-y-1.5 ${span}`}>
            {labelText}
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
                  {field.optional && field.options
                    ? "Não informado"
                    : isLoadingOptions && field.optionsKey
                    ? "Carregando..."
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
                type={field.type === "integer" ? "number" : field.type ?? "text"}
                placeholder={field.placeholder}
                pattern={field.pattern}
                maxLength={field.maxLength}
                min={field.min}
                max={field.type === "date" ? toDateInput(new Date().toISOString()) : field.max}
                step={field.type === "integer" ? "1" : field.step}
              />
            )}
          </label>
        );
      })}

      <div className="flex justify-end pt-2 sm:col-span-2">
        <button
          type="submit"
          disabled={isSubmitting || (optionType !== null && isLoadingOptions) || (optionType !== null && options.length === 0)}
          className="h-10 rounded-md bg-ambar-400 px-4 text-sm font-bold text-marinho-900 transition-colors hover:bg-ambar-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}