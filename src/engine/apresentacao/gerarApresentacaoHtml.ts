import type { DadosApuradosCliente } from "../sped/agregador";
import type { Panorama } from "../panorama";
import type { ResultadoSimulacao } from "../types";
import { parametros } from "../parametros";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function pct(v: number) {
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ApresentacaoParams {
  nomeEmpresa: string;
  logoSvg: string;
  dados: DadosApuradosCliente;
  panorama: Panorama;
  resultado: ResultadoSimulacao;
}

/**
 * Gera um HTML autocontido (CSS/JS inline, sem dependência externa) no estilo
 * apresentação/slide-deck para o contador exportar e apresentar ao cliente —
 * sidebar de navegação, cartões de KPI, linha do tempo e conclusão, com
 * suporte a impressão em PDF. Populado com os números já calculados pelo
 * motor (dados apurados + panorama + resultado da simulação), não com
 * conteúdo escrito à mão por cliente.
 */
export function gerarApresentacaoHtml({ nomeEmpresa, logoSvg, dados, panorama, resultado }: ApresentacaoParams): string {
  const ano2027 = resultado.anos.find((a) => a.ano === parametros.anos.inicioCobrancaEfetiva);
  const anoPleno = resultado.anos[resultado.anos.length - 1];
  const cargaAtual = dados.tributosRecolhidos.icms + dados.tributosRecolhidos.pis + dados.tributosRecolhidos.cofins;
  const cargaAtualPct = dados.faturamento > 0 ? cargaAtual / dados.faturamento : 0;
  const cargaPlenaPct = resultado.input.faturamentoAnual > 0 ? anoPleno.cargaNovaPropriaEmpresa / resultado.input.faturamentoAnual : 0;
  const deltaReais = anoPleno.cargaNovaPropriaEmpresa - cargaAtual;

  const linhasTempo = resultado.anos
    .map((a) => {
      const maxCarga = Math.max(...resultado.anos.map((x) => x.cargaNovaPropriaEmpresa), cargaAtual, 1);
      const alturaPct = Math.max(4, (a.cargaNovaPropriaEmpresa / maxCarga) * 100);
      return `<div class="barra-col"><div class="barra" style="height:${alturaPct}%"></div><span class="barra-valor">${moeda(a.cargaNovaPropriaEmpresa)}</span><span class="barra-ano">${a.ano}</span></div>`;
    })
    .join("");

  const itensPorTipo = (tipo: string) =>
    panorama.itens
      .filter((i) => i.tipo === tipo)
      .map((i) => `<div class="card"><h4>${escapeHtml(i.titulo)}</h4><p>${escapeHtml(i.descricao)}</p></div>`)
      .join("");

  const slides = [
    {
      titulo: "Resumo executivo",
      conteudo: `
        <p class="lead">${escapeHtml(panorama.resumo)}</p>
        <div class="kpis">
          ${panorama.indicadores
            .map((ind) => `<div class="kpi kpi-${ind.tom}"><span class="kpi-rotulo">${escapeHtml(ind.rotulo)}</span><span class="kpi-valor">${escapeHtml(ind.valor)}</span></div>`)
            .join("")}
        </div>`,
    },
    {
      titulo: "Carga tributária hoje",
      conteudo: `
        <div class="kpis">
          <div class="kpi"><span class="kpi-rotulo">Imposto pago hoje (ICMS + PIS + COFINS)</span><span class="kpi-valor">${moeda(cargaAtual)}</span></div>
          <div class="kpi"><span class="kpi-rotulo">% do faturamento</span><span class="kpi-valor">${pct(cargaAtualPct)}</span></div>
          <div class="kpi"><span class="kpi-rotulo">Faturamento base</span><span class="kpi-valor">${moeda(dados.faturamento)}</span></div>
        </div>`,
    },
    ...(ano2027
      ? [
          {
            titulo: `Projeção ${ano2027.ano} — início da cobrança efetiva`,
            conteudo: `
        <div class="kpis">
          <div class="kpi"><span class="kpi-rotulo">Faturamento simulado</span><span class="kpi-valor">${moeda(resultado.input.faturamentoAnual)}</span></div>
          <div class="kpi"><span class="kpi-rotulo">CBS/IBS estimado</span><span class="kpi-valor">${moeda(ano2027.cargaNovaPropriaEmpresa)}</span></div>
          <div class="kpi"><span class="kpi-rotulo">Alíquota total efetiva</span><span class="kpi-valor">${pct(ano2027.aliquotaTotal)}</span></div>
        </div>`,
          },
        ]
      : []),
    {
      titulo: `Evolução até ${anoPleno.ano} (sistema pleno)`,
      conteudo: `
        <div class="kpis">
          <div class="kpi"><span class="kpi-rotulo">Imposto em ${anoPleno.ano}</span><span class="kpi-valor">${moeda(anoPleno.cargaNovaPropriaEmpresa)}</span></div>
          <div class="kpi"><span class="kpi-rotulo">% do faturamento em ${anoPleno.ano}</span><span class="kpi-valor">${pct(cargaPlenaPct)}</span></div>
          <div class="kpi kpi-${deltaReais > 0 ? "negativo" : "positivo"}"><span class="kpi-rotulo">Variação vs. hoje</span><span class="kpi-valor">${moeda(deltaReais)}</span></div>
        </div>
        <div class="timeline">${linhasTempo}</div>`,
    },
    ...(itensPorTipo("risco") ? [{ titulo: "Pontos de atenção", conteudo: `<div class="cards">${itensPorTipo("risco")}</div>` }] : []),
    ...(itensPorTipo("oportunidade") ? [{ titulo: "Oportunidades", conteudo: `<div class="cards">${itensPorTipo("oportunidade")}</div>` }] : []),
    ...(itensPorTipo("acao_2026") ? [{ titulo: "Ações recomendadas ainda em 2026", conteudo: `<div class="cards">${itensPorTipo("acao_2026")}</div>` }] : []),
    {
      titulo: "Conclusão",
      conteudo: `<p class="lead">${escapeHtml(resultado.recomendacao)}</p>`,
    },
  ];

  const slidesHtml = slides
    .map(
      (s, i) => `
    <section class="slide" id="slide-${i}">
      <header class="slide-header">
        <div class="slide-logo">${logoSvg}</div>
        <div>
          <h1>${escapeHtml(nomeEmpresa || "Cliente")}</h1>
          <h2>${escapeHtml(s.titulo)}</h2>
        </div>
      </header>
      <div class="slide-content">${s.conteudo}</div>
      <footer class="slide-footer">Simulação gerencial — não substitui apuração fiscal formal. ${i + 1}/${slides.length}</footer>
    </section>`
    )
    .join("\n");

  const navHtml = slides
    .map((s, i) => `<button type="button" class="nav-btn" data-target="slide-${i}">${i + 1}. ${escapeHtml(s.titulo)}</button>`)
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Apresentação — ${escapeHtml(nomeEmpresa || "Cliente")} — Reforma Tributária</title>
<style>
  :root {
    --navy: #0b2545; --green: #1c7c54; --gold: #c9a227; --red: #b23a48;
    --bg: #f4f6f8; --card: #ffffff; --text: #16202b; --muted: #5b6b79;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: var(--bg); color: var(--text); display: flex; }
  .sidebar { width: 260px; background: var(--navy); color: #fff; padding: 24px 16px; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .sidebar h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #a9bdd4; margin: 0 0 8px; }
  .nav-btn { text-align: left; background: transparent; border: none; color: #d9e4f0; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; line-height: 1.3; }
  .nav-btn:hover, .nav-btn.active { background: rgba(255,255,255,0.12); color: #fff; }
  .print-btn { margin-top: auto; background: var(--gold); color: #16202b; border: none; padding: 10px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .conteudo { margin-left: 260px; flex: 1; padding: 32px; max-width: 980px; }
  .slide { background: var(--card); border-radius: 16px; padding: 32px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .slide-header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid var(--bg); padding-bottom: 16px; margin-bottom: 20px; }
  .slide-logo svg { height: 40px; }
  .slide-header h1 { font-size: 15px; margin: 0; color: var(--muted); font-weight: 600; }
  .slide-header h2 { font-size: 22px; margin: 2px 0 0; color: var(--navy); }
  .lead { font-size: 16px; line-height: 1.6; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 16px 0; }
  .kpi { background: var(--bg); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px; border-left: 4px solid var(--navy); }
  .kpi-positivo { border-left-color: var(--green); }
  .kpi-negativo { border-left-color: var(--red); }
  .kpi-rotulo { font-size: 12px; color: var(--muted); }
  .kpi-valor { font-size: 20px; font-weight: 700; color: var(--navy); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
  .card { background: var(--bg); border-radius: 12px; padding: 16px; }
  .card h4 { margin: 0 0 8px; color: var(--navy); font-size: 15px; }
  .card p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--text); }
  .timeline { display: flex; gap: 12px; align-items: flex-end; height: 220px; margin-top: 24px; padding: 0 8px; }
  .barra-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; flex: 1; height: 100%; gap: 4px; }
  .barra { width: 70%; background: linear-gradient(180deg, var(--gold), var(--navy)); border-radius: 4px 4px 0 0; min-height: 4px; }
  .barra-valor { font-size: 10px; color: var(--muted); }
  .barra-ano { font-size: 12px; font-weight: 600; color: var(--navy); }
  .slide-footer { margin-top: 24px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--bg); padding-top: 12px; }
  @media print {
    .sidebar { display: none; }
    .conteudo { margin-left: 0; }
    .slide { break-after: page; box-shadow: none; }
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #10161d; --card: #182230; --text: #e7edf3; --muted: #9fb0bf; }
    .kpi { background: #0f1620; }
    .card { background: #0f1620; }
  }
</style>
</head>
<body>
  <nav class="sidebar">
    <h3>Apresentação</h3>
    ${navHtml}
    <button type="button" class="print-btn" onclick="window.print()">Exportar PDF</button>
  </nav>
  <main class="conteudo">
    ${slidesHtml}
  </main>
  <script>
    const botoes = document.querySelectorAll(".nav-btn");
    botoes.forEach((b) => b.addEventListener("click", () => {
      document.getElementById(b.dataset.target)?.scrollIntoView({ behavior: "smooth" });
    }));
    const slides = Array.from(document.querySelectorAll(".slide"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        botoes.forEach((b) => b.classList.toggle("active", b.dataset.target === entry.target.id));
      });
    }, { threshold: 0.5 });
    slides.forEach((s) => observer.observe(s));
  </script>
</body>
</html>`;
}
