import { Link } from "react-router-dom";
import { useClienteData } from "../context/ClienteDataContext";
import { TopBar, Body, EmptyState, Button, KpiGrid, KpiCard, TaxStat } from "../design-system";
import { PainelParceiros } from "../components/PainelParceiros";

export default function Parceiros() {
  const { cliente } = useClienteData();

  if (!cliente) {
    return (
      <>
        <TopBar crumb="Parceiros" title="Fornecedores e clientes" />
        <Body>
          <EmptyState
            icon="☰"
            title="Nenhum parceiro para analisar"
            description="Importe os arquivos fiscais da empresa para identificar fornecedores e clientes e o impacto de cada um no crédito."
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

  const { nomeEmpresa, dados } = cliente;
  const total = dados.parceirosComExposicao.length;
  const elegiveis = dados.parceirosComExposicao.filter((p) => p.participante.regime !== "desconhecido" && !p.participante.restringeCreditoDoCliente).length;
  const percentualElegivel = total > 0 ? elegiveis / total : 0;

  return (
    <>
      <TopBar crumb="Parceiros" title="Fornecedores e clientes" meta={<span>{nomeEmpresa}</span>} />
      <Body>
        <p className="vgr-lede">Análise de exposição ao crédito de CBS/IBS por fornecedor e cliente — clique num grupo para ver as empresas.</p>

        <KpiGrid>
          <div className="vgr-kpi static">
            <span className="vgr-kpi-label">Parceiros identificados</span>
            <span className="vgr-tstat">
              <span className="vgr-tstat-pct tab">{total}</span>
              <span className="vgr-tstat-reais">fornecedores e clientes</span>
            </span>
          </div>
          <KpiCard
            label="Elegíveis a crédito integral"
            state="good"
            value={<TaxStat percent={percentualElegivel} reaisLabel={`${elegiveis} de ${total}`} tone="good" />}
          />
        </KpiGrid>

        <div className="vgr-section-title">Exposição por grupo</div>
        <PainelParceiros dados={dados} />
      </Body>
    </>
  );
}
