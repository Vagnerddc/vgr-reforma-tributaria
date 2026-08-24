import { Link } from "react-router-dom";
import { useClienteData } from "../context/ClienteDataContext";
import { TopBar, Body, KpiCard, KpiGrid, TaxStat, TaxReductionStat, EmptyState, Button, comparativoDoResultado } from "../design-system";
import { parametros } from "../engine/parametros";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const { cliente } = useClienteData();

  if (!cliente) {
    return (
      <>
        <TopBar crumb="Dashboard" title="Visão executiva" />
        <Body>
          <EmptyState
            icon="☐"
            title="Nenhum dado importado ainda"
            description="Importe os arquivos fiscais da empresa em /importar para ver a carga tributária, os créditos identificados e a economia potencial da reforma."
            action={
              <Link to="/importar">
                <Button variant="primary">Importar arquivos</Button>
              </Link>
            }
          />
        </Body>
      </>
    );
  }

  const { nomeEmpresa, dados, resultadoSimulacao } = cliente;

  if (!resultadoSimulacao) {
    return (
      <>
        <TopBar crumb="Dashboard" title={nomeEmpresa} />
        <Body>
          <EmptyState
            icon="◧"
            title="Simulação ainda não gerada"
            description="Os arquivos fiscais já foram importados. Volte a /importar e finalize os dados da empresa para calcular a carga tributária e a economia potencial."
            action={
              <Link to="/importar">
                <Button variant="primary">Concluir simulação</Button>
              </Link>
            }
          />
        </Body>
      </>
    );
  }

  const { comparativo, anoAtual, anoPleno } = comparativoDoResultado(resultadoSimulacao, dados.faturamento);
  const reducao = comparativo.deltaPontosPercentuais >= 0;

  return (
    <>
      <TopBar
        crumb="Dashboard"
        title={nomeEmpresa}
        meta={
          <>
            <span>
              Período: {dados.periodoInicio ?? "—"} a {dados.periodoFim ?? "—"}
            </span>
          </>
        }
      />
      <Body>
        <p className="vgr-lede">Resumo executivo do cliente, com base na apuração real dos arquivos importados.</p>

        <KpiGrid>
          <KpiCard
            label="Faturamento apurado"
            value={
              <span className="vgr-tstat">
                <span className="vgr-tstat-pct tab">{moeda(dados.faturamento)}</span>
                <span className="vgr-tstat-reais">{dados.periodoInicio ?? "—"} a {dados.periodoFim ?? "—"}</span>
              </span>
            }
          />
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

        <div className="vgr-section-title">Diagnóstico</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dados.conferenciaEfdEcd && Math.abs(dados.conferenciaEfdEcd.diferencaPercentual) > 0.05 && (
            <div className="vgr-alert vgr-alert-danger">
              <span>▲</span>
              <span>
                <b>Risco — divergência EFD × ECD.</b> Faturamento pelas EFDs {moeda(dados.conferenciaEfdEcd.faturamentoEfd)} vs.
                receita na ECD {moeda(dados.conferenciaEfdEcd.faturamentoEcd)} — confira se falta algum mês de EFD.
              </span>
            </div>
          )}
          {resultadoSimulacao.avisos.map((aviso, i) => (
            <div key={i} className="vgr-alert vgr-alert-warn">
              <span>⚠</span>
              <span>{aviso}</span>
            </div>
          ))}
          <div className="vgr-alert vgr-alert-info">
            <span>💡</span>
            <span>{resultadoSimulacao.recomendacao}</span>
          </div>
        </div>

        <div className="vgr-section-title">Ver mais</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/importar">
            <Button variant="secondary">Ajustar dados da empresa</Button>
          </Link>
        </div>

        <p style={{ fontSize: 11, color: "var(--vgr-text-faint)", marginTop: 24 }}>
          Ano de referência do sistema pleno: {parametros.anos.sistemaPleno}.
        </p>
      </Body>
    </>
  );
}
