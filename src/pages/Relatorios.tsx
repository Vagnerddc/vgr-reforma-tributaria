import { Link } from "react-router-dom";
import { useClienteData } from "../context/ClienteDataContext";
import { TopBar, Body, EmptyState, Button, Card, useToast } from "../design-system";
import { gerarApresentacaoHtml } from "../engine/apresentacao/gerarApresentacaoHtml";
import logoVgrSvgTexto from "../assets/vgr/logo-vgr.svg?raw";

function pct(v: number) {
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}
function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function Relatorios() {
  const { cliente } = useClienteData();
  const { showToast } = useToast();

  if (!cliente || !cliente.resultadoSimulacao || !cliente.panorama) {
    return (
      <>
        <TopBar crumb="Relatórios" title="Relatórios e apresentações" />
        <Body>
          <EmptyState
            icon="▢"
            title="Nenhum relatório disponível"
            description="Conclua uma simulação em /importar para gerar a apresentação executiva do cliente."
            action={
              <Link to="/importar">
                <Button variant="primary">Ir para a simulação</Button>
              </Link>
            }
          />
        </Body>
      </>
    );
  }

  const { nomeEmpresa, dados, resultadoSimulacao, panorama } = cliente;

  function handleGerarApresentacao() {
    const html = gerarApresentacaoHtml({ nomeEmpresa, logoSvg: logoVgrSvgTexto, dados, panorama: panorama!, resultado: resultadoSimulacao! });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    showToast("Apresentação gerada com sucesso");
  }

  function handleExportarTxt() {
    const linhas: string[] = [];
    linhas.push("RELATÓRIO GERENCIAL — IMPACTO DA REFORMA TRIBUTÁRIA");
    linhas.push(`Empresa: ${nomeEmpresa}`);
    linhas.push("");
    linhas.push("Ano | Alíquota CBS+IBS | Carga atual (ref.) | Carga projetada | Delta");
    resultadoSimulacao!.anos.forEach((a) => {
      linhas.push(`${a.ano} | ${pct(a.aliquotaTotal)} | ${moeda(a.cargaAtualReferencia)} | ${moeda(a.cargaNovaPropriaEmpresa)} | ${pct(a.deltaCargaPercentual)}`);
    });
    linhas.push("");
    linhas.push(`Recomendação: ${resultadoSimulacao!.recomendacao}`);
    const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${nomeEmpresa}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Relatório .txt exportado");
  }

  const anoPleno = resultadoSimulacao.anos[resultadoSimulacao.anos.length - 1];

  return (
    <>
      <TopBar crumb="Relatórios" title="Relatórios e apresentações" meta={<span>{nomeEmpresa}</span>} />
      <Body>
        <p className="vgr-lede">Gere documentos prontos para enviar ao cliente ou apresentar internamente, a partir da simulação atual.</p>

        <div className="comp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
          <Card title="Apresentação executiva (HTML)">
            <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: "0 0 12px" }}>
              Resumo visual com carga atual, projetada e economia potencial até {anoPleno.ano} — mesmo padrão executivo do Resultado.
            </p>
            <Button variant="primary" onClick={handleGerarApresentacao}>
              Gerar apresentação
            </Button>
          </Card>
          <Card title="Relatório técnico (.txt)">
            <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: "0 0 12px" }}>
              Detalhamento ano a ano (alíquota, carga atual, carga projetada, variação) em texto simples.
            </p>
            <Button variant="secondary" onClick={handleExportarTxt}>
              Exportar .txt
            </Button>
          </Card>
        </div>

        <p style={{ fontSize: 11, color: "var(--vgr-text-faint)" }}>
          Nota: o histórico de relatórios gerados ainda não é persistido — cada exportação usa os dados da simulação carregada agora
          nesta sessão do navegador (não há backend de armazenamento neste sistema).
        </p>
      </Body>
    </>
  );
}
