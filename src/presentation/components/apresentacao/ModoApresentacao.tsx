/**
 * Modo Apresentação Executivo — narrativa em capítulos sobre o MESMO
 * `ApresentacaoExecutivaViewModel` (nunca recalcula nada — seção 1/2).
 * Reaproveita os componentes de seção já existentes; nenhuma fórmula
 * nova, nenhuma chamada a motor/IA ao navegar (seção 66/67/100).
 */

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, LogoVgr } from "../../../design-system";
import { formatarPercentualPt, formatarReaisCompacto, ROTULO_INDISPONIVEL } from "../../formatters";
import { CardDecisaoEstrategica } from "../CardDecisaoEstrategica";
import { SecaoPorQue } from "../SecaoPorQue";
import { ComparacaoRegimesTabela } from "../ComparacaoRegimesTabela";
import { SecaoImpactoCaixa } from "../SecaoImpactoCaixa";
import { TimelineEstrategica } from "../TimelineEstrategica";
import { SecaoPontosVirada } from "../SecaoPontosVirada";
import { SecaoScoreEstrategico } from "../SecaoScoreEstrategico";
import { SecaoPlanoAcao } from "../SecaoPlanoAcao";
import { SecaoParetoFronteira } from "../SecaoParetoFronteira";
import { indiceAnterior, indiceProximo, indiceValido } from "./navegacao";
import type { ApresentacaoExecutivaViewModel, CapituloApresentacao } from "../../viewModels/apresentacao";

function SlideImpacto({ vm }: { vm: ApresentacaoExecutivaViewModel }) {
  const resumo = vm.vm.resumo;
  return (
    <div className="vgr-apresentacao-slide vgr-apresentacao-impacto">
      <p className="vgr-apresentacao-eyebrow">Análise Tributária Estratégica</p>
      <h1>{vm.nomeEmpresa ?? "Empresa"}</h1>
      <p className="vgr-apresentacao-periodo">{vm.ano}</p>
      <div className="vgr-apresentacao-kpis">
        <div>
          <span className="vgr-apresentacao-kpi-label">Carga projetada</span>
          <span className="vgr-apresentacao-kpi-valor">{resumo?.cargaProjetada.disponivel ? formatarPercentualPt(resumo.cargaProjetada.valor! * 100) : ROTULO_INDISPONIVEL}</span>
        </div>
        <div>
          <span className="vgr-apresentacao-kpi-label">Margem projetada</span>
          <span className="vgr-apresentacao-kpi-valor">{resumo?.margemProjetada.disponivel ? formatarPercentualPt(resumo.margemProjetada.valor! * 100) : ROTULO_INDISPONIVEL}</span>
        </div>
        <div>
          <span className="vgr-apresentacao-kpi-label">Impacto anual</span>
          <span className="vgr-apresentacao-kpi-valor">{resumo?.impactoAnualReais.disponivel ? formatarReaisCompacto(resumo.impactoAnualReais.valor!) : ROTULO_INDISPONIVEL}</span>
        </div>
      </div>
      {vm.vm.decisao && (
        <p className="vgr-apresentacao-decisao-resumo">
          Decisão: <strong>{vm.vm.decisao.rotuloStatus}</strong>
        </p>
      )}
    </div>
  );
}

function SlideIa({ vm }: { vm: ApresentacaoExecutivaViewModel }) {
  if (!vm.ia) return null;
  return (
    <div className="vgr-apresentacao-slide">
      <h2>Leitura Consultiva</h2>
      <p>{vm.ia.resumoExecutivo}</p>
      <p>{vm.ia.explicacao}</p>
      {vm.ia.condicoes.length > 0 && (
        <Alert tone="warn">
          <ul>
            {vm.ia.condicoes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}

function SlideLimitacoes({ vm }: { vm: ApresentacaoExecutivaViewModel }) {
  return (
    <div className="vgr-apresentacao-slide">
      <h2>Premissas e pontos de atenção</h2>
      <ul>
        {vm.limitacoesMateriais.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function ConteudoCapitulo({ capitulo, vm }: { capitulo: CapituloApresentacao; vm: ApresentacaoExecutivaViewModel }) {
  switch (capitulo) {
    case "impacto":
      return <SlideImpacto vm={vm} />;
    case "decisao":
      return vm.vm.decisao ? <CardDecisaoEstrategica vm={vm.vm.decisao} /> : null;
    case "evidencias":
      return vm.vm.decisao ? <SecaoPorQue vm={vm.vm.decisao} /> : null;
    case "regimes":
      return <ComparacaoRegimesTabela linhas={vm.vm.comparacaoRegimes} />;
    case "caixa":
      return <SecaoImpactoCaixa vm={vm.vm.caixa} />;
    case "timeline":
      return vm.vm.timeline ? <TimelineEstrategica vm={vm.vm.timeline} /> : null;
    case "pontosVirada":
      return <SecaoPontosVirada pontos={vm.vm.pontosVirada} />;
    case "score":
      return vm.vm.scores ? <SecaoScoreEstrategico scores={vm.vm.scores} /> : null;
    case "plano":
      return vm.vm.planoAcao ? <SecaoPlanoAcao etapas={vm.vm.planoAcao.etapas} /> : null;
    case "pareto":
      return vm.vm.pareto ? <SecaoParetoFronteira vm={vm.vm.pareto} /> : null;
    case "ia":
      return <SlideIa vm={vm} />;
    case "limitacoes":
      return <SlideLimitacoes vm={vm} />;
  }
}

function suportaFullscreen(): boolean {
  return typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen);
}

export function ModoApresentacao({
  vm,
  indiceInicial = 0,
  onSair,
  onAbrirMemoriaTecnica,
}: {
  vm: ApresentacaoExecutivaViewModel;
  indiceInicial?: number;
  onSair: (indiceAtual: number) => void;
  onAbrirMemoriaTecnica?: () => void;
}) {
  const total = vm.capitulos.length;
  const [indice, setIndice] = useState(() => indiceValido(indiceInicial, total));

  const proximo = useCallback(() => setIndice((i) => indiceProximo(i, total)), [total]);
  const anterior = useCallback(() => setIndice((i) => indiceAnterior(i)), []);
  const sair = useCallback(() => onSair(indice), [onSair, indice]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "ArrowRight") proximo();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === "Escape") sair();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [proximo, anterior, sair]);

  useEffect(() => {
    const titulo = document.getElementById("vgr-apresentacao-titulo-capitulo");
    titulo?.focus();
  }, [indice]);

  function alternarTelaCheia() {
    if (!suportaFullscreen()) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  if (total === 0) {
    return (
      <div className="vgr-apresentacao">
        <Alert tone="info">Nenhum conteúdo disponível para apresentação nesta análise.</Alert>
        <Button variant="secondary" onClick={sair}>
          Sair da apresentação
        </Button>
      </div>
    );
  }

  const capituloAtual = vm.capitulos[indice];

  return (
    <div className="vgr-apresentacao" role="region" aria-label="Modo apresentação">
      <header className="vgr-apresentacao-header">
        <LogoVgr />
        <span>
          {vm.nomeEmpresa} · {vm.ano}
        </span>
        <div>
          {suportaFullscreen() && (
            <Button variant="tertiary" onClick={alternarTelaCheia} aria-label="Alternar tela cheia">
              Tela cheia
            </Button>
          )}
          {onAbrirMemoriaTecnica && (
            <Button variant="tertiary" onClick={onAbrirMemoriaTecnica}>
              Abrir memória técnica
            </Button>
          )}
          <Button variant="tertiary" onClick={sair}>
            Sair da apresentação
          </Button>
        </div>
      </header>

      <h2 id="vgr-apresentacao-titulo-capitulo" tabIndex={-1}>
        {capituloAtual.titulo}
      </h2>

      <main aria-live="polite">
        <ConteudoCapitulo capitulo={capituloAtual.id} vm={vm} />
      </main>

      <nav className="vgr-apresentacao-nav" aria-label="Navegação de capítulos">
        <Button variant="secondary" onClick={anterior} disabled={indice === 0} aria-label="Capítulo anterior">
          ← Anterior
        </Button>
        <span aria-current="step">
          <Badge tone="neutral">
            {indice + 1} de {total}
          </Badge>
        </span>
        <Button variant="secondary" onClick={proximo} disabled={indice === total - 1} aria-label="Próximo capítulo">
          Próximo →
        </Button>
      </nav>
    </div>
  );
}
