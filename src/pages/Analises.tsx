import { Link } from "react-router-dom";
import { useClienteData } from "../context/ClienteDataContext";
import {
  TopBar,
  Body,
  EmptyState,
  Button,
  KpiGrid,
  KpiCard,
  TaxStat,
  TaxReductionStat,
  CargaLineChart,
  comparativoDoResultado,
  serieCargaPorAno,
  formatarReais,
  formatarPercentualPt,
} from "../design-system";

export default function Analises() {
  const { cliente } = useClienteData();

  if (!cliente || !cliente.resultadoSimulacao) {
    return (
      <>
        <TopBar crumb="Análises" title="Análise tributária comparativa" />
        <Body>
          <EmptyState
            icon="◆"
            title="Nenhuma análise disponível"
            description="Importe os arquivos fiscais e conclua a simulação para gerar comparativos de carga tributária."
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
  const { comparativo, anoAtual, anoPleno } = comparativoDoResultado(resultadoSimulacao, dados.faturamento);
  const serieCarga = serieCargaPorAno(resultadoSimulacao, dados.faturamento);
  const reducao = comparativo.deltaPontosPercentuais >= 0;

  const fornecedores = dados.parceirosComExposicao
    .filter((p) => p.papel === "fornecedor" || p.papel === "ambos")
    .slice()
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, 5);
  const totalCompras = dados.parceirosComExposicao
    .filter((p) => p.papel === "fornecedor" || p.papel === "ambos")
    .reduce((s, p) => s + p.valorTotal, 0);

  return (
    <>
      <TopBar
        crumb="Análises"
        title="Análise tributária comparativa"
        meta={<span>{nomeEmpresa}</span>}
        actions={
          <Link to="/analises/estrategica">
            <Button variant="tertiary">Ver análise estratégica →</Button>
          </Link>
        }
      />
      <Body>
        <p className="vgr-lede">Comparativos derivados diretamente da simulação já calculada — sem indicadores novos ou benchmarks externos.</p>

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

        <div className="vgr-section-title">Composição do sistema novo em {anoPleno.ano} (CBS × IBS)</div>
        <div style={{ border: "1px solid var(--vgr-border)", borderRadius: "var(--vgr-radius)", overflow: "hidden" }}>
          <table className="vgr-table">
            <thead>
              <tr>
                <th>Tributo</th>
                <th style={{ textAlign: "right" }}>Débito bruto</th>
                <th style={{ textAlign: "right" }}>Crédito apurado</th>
                <th style={{ textAlign: "right" }}>Efetivo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>CBS</td>
                <td className="num">{formatarReais(anoPleno.debitoBrutoCbs)}</td>
                <td className="num">{formatarReais(anoPleno.creditoApuradoCbs)}</td>
                <td className="num">{formatarReais(anoPleno.efetivoCbs)}</td>
              </tr>
              <tr>
                <td>IBS</td>
                <td className="num">{formatarReais(anoPleno.debitoBrutoIbs)}</td>
                <td className="num">{formatarReais(anoPleno.creditoApuradoIbs)}</td>
                <td className="num">{formatarReais(anoPleno.efetivoIbs)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {fornecedores.length > 0 && (
          <>
            <div className="vgr-section-title">Top fornecedores por volume de compra</div>
            <div style={{ border: "1px solid var(--vgr-border)", borderRadius: "var(--vgr-radius)", overflow: "hidden", marginBottom: 12 }}>
              <table className="vgr-table">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th style={{ textAlign: "right" }}>% das compras</th>
                    <th style={{ textAlign: "right" }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedores.map((f) => (
                    <tr key={f.participante.codPart}>
                      <td>{f.participante.nome}</td>
                      <td className="num">{formatarPercentualPt(totalCompras > 0 ? (f.valorTotal / totalCompras) * 100 : 0)}</td>
                      <td className="num">{formatarReais(f.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to="/parceiros">
              <Button variant="tertiary" style={{ paddingLeft: 0 }}>
                Ver todos os parceiros →
              </Button>
            </Link>
          </>
        )}
      </Body>
    </>
  );
}
