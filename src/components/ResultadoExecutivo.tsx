import { useMemo, useState } from "react";
import type { DadosApuradosCliente } from "../engine/sped/agregador";
import type { ResultadoSimulacao } from "../engine/types";
import type { Panorama } from "../engine/panorama";
import { parametros } from "../engine/parametros";
import { simular } from "../engine/calculo";
import { cargaPercentualDoAno } from "../design-system";
import { TabelaDetalhamento } from "./TabelaDetalhamento";
import { TabelaComparativoSistemas } from "./TabelaComparativoSistemas";
import { PainelParceiros } from "./PainelParceiros";
import {
  KpiCard,
  KpiGrid,
  TaxStat,
  TaxReductionStat,
  Drawer,
  DrawerRow,
  Badge,
  Button,
  Alert,
  DetailToggle,
  CargaLineChart,
  comparativoDoResultado,
  serieCargaPorAno,
  formatarReais,
  formatarPercentualPt,
} from "../design-system";

const LABEL_TIPO: Record<string, { titulo: string; tone: "accent" | "gold" | "danger"; icone: string }> = {
  oportunidade: { titulo: "Oportunidade", tone: "accent", icone: "💡" },
  acao_2026: { titulo: "Atenção", tone: "gold", icone: "⚠" },
  risco: { titulo: "Risco", tone: "danger", icone: "▲" },
};

/**
 * Indicador de qualidade da simulação — não é um score sofisticado, só
 * reflete quão granular foi a fonte dos dados de custo: ECD real > custos
 * detalhados manualmente por categoria > percentual único simplificado.
 */
function calcularQualidadeSimulacao(
  dados: DadosApuradosCliente,
  resultadoSimulacao: ResultadoSimulacao
): { titulo: string; descricao: string; tone: "accent" | "gold" } {
  if (dados.fonteDespesas === "ecd") {
    return {
      titulo: "Alta confiabilidade",
      descricao: "Custos e despesas vindos da ECD, classificados conta a conta — não é uma estimativa agregada.",
      tone: "accent",
    };
  }
  if (
    resultadoSimulacao.input.percentualCustosCreditaveisSistemaAtual !== undefined ||
    resultadoSimulacao.input.percentualCustosCreditaveisNovoSistema !== undefined
  ) {
    return {
      titulo: "Simulação detalhada",
      descricao: "Estrutura de custos informada por grupo (custo direto, operacional, folha, administrativo), com tratamento de crédito separado por sistema tributário.",
      tone: "accent",
    };
  }
  return {
    titulo: "Simulação estimada",
    descricao: "Baseada num percentual único de custos creditáveis — para maior precisão, detalhe a composição de custos e despesas no passo do wizard.",
    tone: "gold",
  };
}

/**
 * Tela executiva de Resultado — baseline visual aprovada no protótipo.
 * Recebe dados/resultadoSimulacao/panorama já calculados (nenhum cálculo
 * próprio) e só reorganiza a apresentação com %+R$ em destaque, p.p. vs.
 * redução relativa corretamente distintos, e diagnósticos vindos direto de
 * panorama.itens — nunca inventa uma conclusão tributária nova.
 */
export function ResultadoExecutivo({
  dados,
  resultadoSimulacao,
  panorama,
}: {
  dados: DadosApuradosCliente;
  resultadoSimulacao: ResultadoSimulacao;
  panorama: Panorama;
}) {
  const [drawerAberto, setDrawerAberto] = useState(false);
  const { comparativo, anoAtual, anoPleno } = comparativoDoResultado(resultadoSimulacao, dados.faturamento);
  const reducao = comparativo.deltaPontosPercentuais >= 0;

  const observacoesUnicas = Array.from(new Set(resultadoSimulacao.anos.flatMap((a) => a.observacoes)));
  const serieCarga = serieCargaPorAno(resultadoSimulacao, dados.faturamento);
  const ano2027 = resultadoSimulacao.anos.find((a) => a.ano === parametros.anos.inicioCobrancaEfetiva);
  const qualidade = calcularQualidadeSimulacao(dados, resultadoSimulacao);

  // Análise de sensibilidade — NÃO é uma regra tributária nova: só compara o
  // mesmo simular() com e sem os créditos estimados, para mostrar quanto do
  // resultado depende do aproveitamento de crédito informado.
  const impactoCreditos = useMemo(() => {
    const semCreditos = simular({
      ...resultadoSimulacao.input,
      percentualCustosCreditaveis: 0,
      percentualCustosCreditaveisSistemaAtual: 0,
      percentualCustosCreditaveisNovoSistema: 0,
    });
    const anoPlenoSemCreditos = semCreditos.anos[semCreditos.anos.length - 1];
    const anoPlenoComCreditos = resultadoSimulacao.anos[resultadoSimulacao.anos.length - 1];
    const percentualSem = cargaPercentualDoAno(anoPlenoSemCreditos, dados.faturamento);
    const percentualCom = cargaPercentualDoAno(anoPlenoComCreditos, dados.faturamento);
    return { percentualSem, percentualCom, deltaPontosPercentuais: (percentualSem - percentualCom) * 100 };
  }, [resultadoSimulacao, dados.faturamento]);

  return (
    <div className="vgr-resultado">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone={reducao ? "accent" : "danger"}>{reducao ? "💡 Oportunidade identificada" : "▲ Atenção"}</Badge>
        <Badge tone={qualidade.tone}>{qualidade.titulo}</Badge>
      </div>
      <div style={{ marginTop: 10 }}>
        <TaxReductionStat comparativo={comparativo} tone={reducao ? "good" : "bad"} size="lg" />
      </div>
      <p className="vgr-lede" style={{ marginTop: 10 }}>
        Carga sai de {formatarPercentualPt(comparativo.cargaAtual * 100)} ({anoAtual.ano}) para{" "}
        {formatarPercentualPt(comparativo.cargaProjetada * 100)} ({anoPleno.ano}).
      </p>

      <KpiGrid>
        <KpiCard
          label={`Carga tributária atual (${anoAtual.ano})`}
          state="warn"
          value={<TaxStat percent={comparativo.cargaAtual} reais={anoAtual.cargaAtualReferencia} tone="bad" />}
        />
        <KpiCard
          label={`Carga tributária projetada (${anoPleno.ano})`}
          state="good"
          value={<TaxStat percent={comparativo.cargaProjetada} reais={anoPleno.cargaNovaPropriaEmpresa} tone="good" />}
        />
        <KpiCard
          label="Redução da carga"
          state={reducao ? "good" : "bad"}
          value={<TaxReductionStat comparativo={comparativo} tone={reducao ? "good" : "bad"} />}
        />
      </KpiGrid>

      <div className="vgr-section-title">Evolução da carga tributária</div>
      <div className="vgr-chart-container">
        <CargaLineChart dados={serieCarga} />
      </div>

      {impactoCreditos.deltaPontosPercentuais > 0.01 && (
        <>
          <div className="vgr-section-title">Impacto estimado dos créditos tributários</div>
          <div className="vgr-card">
            <div className="vgr-kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="vgr-kpi static">
                <span className="vgr-kpi-label">Sem aproveitamento de crédito</span>
                <TaxStat percent={impactoCreditos.percentualSem} tone="bad" />
              </div>
              <div className="vgr-kpi static">
                <span className="vgr-kpi-label">Com aproveitamento estimado</span>
                <TaxStat percent={impactoCreditos.percentualCom} tone="good" />
              </div>
              <div className="vgr-kpi static">
                <span className="vgr-kpi-label">Impacto</span>
                <span className="vgr-tstat good">
                  <span className="vgr-tstat-pct">−{formatarPercentualPt(impactoCreditos.deltaPontosPercentuais).replace("%", "")} p.p.</span>
                </span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--vgr-text-faint)", marginTop: 10, marginBottom: 0 }}>
              Análise de sensibilidade / comparação de cenários — compara o mesmo motor de cálculo com e sem os créditos
              estimados. Não é uma regra tributária independente.
            </p>
          </div>
        </>
      )}

      <div className="vgr-section-title">Por que a carga mudou</div>
      <div className="vgr-card">
        {observacoesUnicas.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
            {observacoesUnicas.map((o, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                {o}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>
            Nenhum fator específico observado além da mudança de regime tributário (CBS/IBS substituindo PIS/COFINS/ICMS).
          </p>
        )}
        <Button variant="tertiary" onClick={() => setDrawerAberto(true)} style={{ marginTop: 8, paddingLeft: 0 }}>
          Ver memória de cálculo →
        </Button>
        <p style={{ fontSize: 11, color: "var(--vgr-text-faint)", marginTop: 10, marginBottom: 0 }}>
          Nota técnica: o engine ainda não expõe a redução isolada por fator (atividade × produto × crédito presumido ×
          split payment) — só o débito bruto e o crédito apurado totais do ano. Uma decomposição visual tipo waterfall
          por fator exigiria calculo.ts calcular e devolver cada delta separadamente; até isso existir, a explicação
          acima usa as observações já geradas pelo motor de cálculo, para não inventar números.
        </p>
      </div>

      <div className="vgr-section-title">Diagnóstico</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {panorama.itens.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)" }}>Nenhum diagnóstico adicional identificado para este cenário.</p>
        )}
        {panorama.itens.map((item, i) => {
          const meta = LABEL_TIPO[item.tipo];
          return (
            <div key={i} className="vgr-card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 17 }}>{meta.icone}</span>
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Badge tone={meta.tone}>{meta.titulo}</Badge>
                </div>
                <strong style={{ display: "block", fontSize: 13.5, marginBottom: 4 }}>{item.titulo}</strong>
                <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>{item.descricao}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vgr-section-title">Detalhamento</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DetailToggle label="Ver quem gera desconto de imposto e quem não gera">
          <PainelParceiros dados={dados} />
        </DetailToggle>

        <DetailToggle label="Ver detalhamento tributário (débito, crédito, CBS/IBS por ano)">
          {ano2027 && (
            <>
              <h4 style={{ fontSize: 12.5, marginTop: 0 }}>2027 — início da cobrança efetiva</h4>
              <TabelaDetalhamento anos={[ano2027]} faturamentoAnual={resultadoSimulacao.input.faturamentoAnual} />
              <TabelaComparativoSistemas anos={[ano2027]} faturamentoAnual={resultadoSimulacao.input.faturamentoAnual} />
            </>
          )}
          <h4 style={{ fontSize: 12.5 }}>Todos os anos ({resultadoSimulacao.anos[0].ano}-{anoPleno.ano})</h4>
          <TabelaDetalhamento anos={resultadoSimulacao.anos} faturamentoAnual={resultadoSimulacao.input.faturamentoAnual} />

          {(dados.avisos.length > 0 || resultadoSimulacao.avisos.length > 0) && (
            <>
              <h4 style={{ fontSize: 12.5 }}>Avisos técnicos</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dados.avisos.map((a, i) => (
                  <Alert key={`d${i}`} tone="warn">⚠ {a}</Alert>
                ))}
                {resultadoSimulacao.avisos.map((a, i) => (
                  <Alert key={`r${i}`} tone="warn">⚠ {a}</Alert>
                ))}
              </div>
            </>
          )}
        </DetailToggle>
      </div>

      <Drawer open={drawerAberto} tag="Memória de cálculo" title={`Ano ${anoPleno.ano}`} onClose={() => setDrawerAberto(false)}>
        <DrawerRow label="Débito bruto (CBS+IBS)" value={formatarReais(anoPleno.debitoBruto)} />
        <DrawerRow label="Crédito apurado" value={formatarReais(anoPleno.creditoApurado)} />
        {anoPleno.custoComplianceAdicional > 0 && (
          <DrawerRow label="Custo de compliance adicional" value={formatarReais(anoPleno.custoComplianceAdicional)} />
        )}
        {anoPleno.saldoCredorAcumuladoFinal > 0 && (
          <DrawerRow label="Saldo credor levado ao próximo ano" value={formatarReais(anoPleno.saldoCredorAcumuladoFinal)} />
        )}
        <DrawerRow label="Carga líquida projetada" value={formatarReais(anoPleno.cargaNovaPropriaEmpresa)} />
        <DrawerRow label="Alíquota total (CBS+IBS)" value={formatarPercentualPt(anoPleno.aliquotaTotal * 100, 2)} />
      </Drawer>
    </div>
  );
}
