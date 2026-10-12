// CEP: máscara 00000-000 e busca de cidade/bairro no ViaCEP.

export const cepDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 8);

// "30130010" → "30130-010" (também formata enquanto a pessoa digita).
export function formatCep(value) {
  const digits = cepDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

const VIACEP_TIMEOUT_MS = 5000;

// { cidade, bairro } do ViaCEP, ou null se o CEP não existir ou o serviço falhar (o cadastro segue sem ele).
// Usa fetch direto, e não o apiFetch, para não enviar o token do painel a um site de fora.
export async function lookupCep(value, signal) {
  const digits = cepDigits(value);
  if (digits.length !== 8) return null;
  const timeout = AbortSignal.timeout(VIACEP_TIMEOUT_MS);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;
    return { cidade: data.localidade ?? "", bairro: data.bairro ?? "" };
  } catch {
    return null;
  }
}

// "Savassi · Belo Horizonte" (só o que estiver preenchido).
export const placeText = (item) => [item?.bairro, item?.cidade].filter(Boolean).join(" · ");
