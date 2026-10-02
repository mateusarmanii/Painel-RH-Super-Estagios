import { useEffect, useState } from "react";

const apiUrl = "http://localhost:3333";
const endpoints = { empresa: "empresas", vaga: "vagas", estudante: "candidatos" };

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
    { name: "email", label: "E-mail", type: "email", placeholder: "estudante@email.com" },
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
    { name: "vaga_id", label: "Vaga", type: "select", optionsKey: "vagas" },
  ],
};

export default function CreationForm({ type, onSuccess }) {
  const [form, setForm] = useState({ horario_estudo: "NOITE" });
  const [options, setOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const optionType = type === "vaga" ? "empresas" : type === "estudante" ? "vagas" : null;

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
        if (isCurrent) setError(loadError.message);
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
    setError("");

    const payload =
      type === "vaga"
        ? { ...form, valor: Number(form.valor) }
        : form;

    try {
      const response = await fetch(`${apiUrl}/${endpoints[type]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível salvar o cadastro.");

      window.dispatchEvent(new Event("dashboard:refresh"));
      onSuccess();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fieldSets[type].map((field) => {
        const commonProps = {
          id: `${type}-${field.name}`,
          name: field.name,
          value: form[field.name] ?? "",
          onChange: updateField,
          required: true,
          className: "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15",
        };

        return (
          <label key={field.name} htmlFor={commonProps.id} className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                {...commonProps}
                rows={3}
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

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

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