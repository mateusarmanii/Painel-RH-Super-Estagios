// Funções comuns dos scripts de teste: chamada à API, PASS/FAIL e espera da API subir.
// Uso: const teste = criarTeste(PORT); const { BASE, req, checar, esperarServidor } = teste;
// teste.falhas conta os FAIL (os scripts também somam sobras de [TESTE] nele).

function criarTeste(port) {
  const BASE = `http://localhost:${port}`;
  const teste = { BASE, falhas: 0 };

  // Chama a API com corpo em JSON (se houver) e devolve { status, body }.
  teste.req = async function req(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  teste.checar = function checar(nome, condicao, detalhe = "") {
    if (!condicao) teste.falhas++;
    console.log(`${condicao ? "PASS" : "FAIL"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  };

  // Variante que compara o status HTTP e mostra a mensagem de erro da API.
  teste.checarStatus = function checarStatus(nome, r, esperado) {
    const ok = r.status === esperado;
    if (!ok) teste.falhas++;
    const msg = r.body?.erro ? ` — "${r.body.erro}"` : "";
    console.log(`${ok ? "PASS" : "FAIL"} [${r.status}] ${nome}${msg}`);
  };

  teste.esperarServidor = async function esperarServidor() {
    for (let i = 0; i < 50; i++) {
      try { await fetch(BASE + "/"); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
    throw new Error("API não subiu");
  };

  return teste;
}

module.exports = { criarTeste };
