import { useMemo, useState } from "react";
import type { DadosApuradosCliente } from "../engine/sped/agregador";
import { gerarOportunidadesParceiros } from "../engine/oportunidadesParceiros";
import { Badge, Button, Drawer, DrawerRow, Alert } from "../design-system";

const LABEL_TIPO_OPORTUNIDADE: Record<string, { titulo: string; tone: "danger" | "accent" | "gold" }> = {
  risco: { titulo: "Risco", tone: "danger" },
  oportunidade: { titulo: "Oportunidade", tone: "accent" },
  acao_2026: { titulo: "Atenção", tone: "gold" },
};

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function pct(v: number) {
  return (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}

const LABEL_REGIME_PARCEIRO: Record<string, string> = {
  normal: "Regime normal",
  simples_nacional: "Simples Nacional",
  pessoa_fisica: "Pessoa física",
  desconhecido: "Não confirmado",
};

type Papel = "fornecedores" | "clientes";
type ChaveGrupo = "sem_credito" | "com_credito" | "nao_confirmado";

export interface Grupo {
  chave: ChaveGrupo;
  titulo: string;
  tom: "positivo" | "negativo" | "neutro";
  quantidade: number;
  valor: number;
  percentual: number;
  parceiros: DadosApuradosCliente["parceirosComExposicao"];
}

export function montarGrupos(lista: DadosApuradosCliente["parceirosComExposicao"]): Grupo[] {
  const total = lista.reduce((s, p) => s + p.valorTotal, 0);
  const somar = (arr: typeof lista) => arr.reduce((s, p) => s + p.valorTotal, 0);

  const semCredito = lista.filter((p) => p.participante.regime !== "desconhecido" && p.participante.restringeCreditoDoCliente);
  const comCredito = lista.filter((p) => p.participante.regime !== "desconhecido" && !p.participante.restringeCreditoDoCliente);
  const naoConfirmado = lista.filter((p) => p.participante.regime === "desconhecido");

  const grupos: Grupo[] = [
    { chave: "sem_credito", titulo: "Não geram crédito integral", tom: "negativo", quantidade: semCredito.length, valor: somar(semCredito), parceiros: semCredito, percentual: 0 },
    { chave: "com_credito", titulo: "Geram crédito integral", tom: "positivo", quantidade: comCredito.length, valor: somar(comCredito), parceiros: comCredito, percentual: 0 },
    { chave: "nao_confirmado", titulo: "Regime não confirmado", tom: "neutro", quantidade: naoConfirmado.length, valor: somar(naoConfirmado), parceiros: naoConfirmado, percentual: 0 },
  ];
  return grupos
    .filter((g) => g.quantidade > 0)
    .map((g) => ({ ...g, percentual: total > 0 ? g.valor / total : 0 }));
}

function tomParaEstado(tom: Grupo["tom"]): "good" | "bad" | "" {
  return tom === "positivo" ? "good" : tom === "negativo" ? "bad" : "";
}

interface PainelParceirosProps {
  dados: DadosApuradosCliente;
}

type Parceiro = DadosApuradosCliente["parceirosComExposicao"][number];

/**
 * Cartões-resumo de fornecedores/clientes por situação de crédito (clicar
 * abre a lista daquele grupo — drill-down em vez de tabela inteira de cara),
 * com busca e drawer de detalhe por empresa.
 */
export function PainelParceiros({ dados }: PainelParceirosProps) {
  const [papel, setPapel] = useState<Papel>("fornecedores");
  const [grupoAberto, setGrupoAberto] = useState<ChaveGrupo | null>(null);
  const [busca, setBusca] = useState("");
  const [parceiroSelecionado, setParceiroSelecionado] = useState<Parceiro | null>(null);

  const listaFiltradaPorPapel = useMemo(
    () =>
      dados.parceirosComExposicao.filter((p) =>
        papel === "fornecedores" ? p.papel === "fornecedor" || p.papel === "ambos" : p.papel === "cliente" || p.papel === "ambos"
      ),
    [dados, papel]
  );

  const grupos = useMemo(() => montarGrupos(listaFiltradaPorPapel), [listaFiltradaPorPapel]);
  const grupoSelecionado = grupos.find((g) => g.chave === grupoAberto) ?? null;
  const oportunidades = useMemo(() => gerarOportunidadesParceiros(grupos, papel), [grupos, papel]);

  const parceirosVisiveis = useMemo(() => {
    if (!grupoSelecionado) return [];
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? grupoSelecionado.parceiros.filter(
          (p) =>
            p.participante.nome.toLowerCase().includes(termo) ||
            (p.participante.cnpj ?? "").includes(termo) ||
            (p.participante.cpf ?? "").includes(termo)
        )
      : grupoSelecionado.parceiros;
    return [...filtrados].sort((a, b) => b.valorTotal - a.valorTotal);
  }, [grupoSelecionado, busca]);

  function trocarPapel(novoPapel: Papel) {
    setPapel(novoPapel);
    setGrupoAberto(null);
    setBusca("");
  }

  function clicarGrupo(chave: ChaveGrupo) {
    setGrupoAberto((atual) => (atual === chave ? null : chave));
    setBusca("");
  }

  function exportarCsv() {
    if (!grupoSelecionado) return;
    const linhas = ["Empresa;CNPJ/CPF;Regime;Valor"];
    for (const p of parceirosVisiveis) {
      linhas.push(
        `${p.participante.nome};${p.participante.cnpj || p.participante.cpf || ""};${LABEL_REGIME_PARCEIRO[p.participante.regime]};${p.valorTotal.toFixed(2)}`
      );
    }
    const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${papel}-${grupoSelecionado.chave}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button variant={papel === "fornecedores" ? "primary" : "secondary"} onClick={() => trocarPapel("fornecedores")}>
          Fornecedores
        </Button>
        <Button variant={papel === "clientes" ? "primary" : "secondary"} onClick={() => trocarPapel("clientes")}>
          Clientes
        </Button>
      </div>

      {grupos.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)" }}>
          Nenhum {papel === "fornecedores" ? "fornecedor" : "cliente"} identificado nos arquivos importados.
        </p>
      ) : (
        <div className="vgr-kpi-grid" style={{ gridTemplateColumns: `repeat(${grupos.length}, 1fr)` }}>
          {grupos.map((g) => {
            const estado = tomParaEstado(g.tom);
            return (
              <div
                key={g.chave}
                className={`vgr-kpi clickable ${estado ? `state-${estado}` : ""} ${grupoAberto === g.chave ? "open" : ""}`}
                onClick={() => clicarGrupo(g.chave)}
                role="button"
                tabIndex={0}
              >
                <span className="vgr-kpi-label">
                  {g.titulo}
                  <span className="vgr-kpi-chevron">›</span>
                </span>
                <span className="vgr-tstat">
                  <span className="vgr-tstat-pct">{g.quantidade}</span>
                  <span className="vgr-tstat-reais">
                    {pct(g.percentual)} {papel === "fornecedores" ? "das compras" : "do faturamento"} · {moeda(g.valor)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {oportunidades.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {oportunidades.map((item, i) => {
            const meta = LABEL_TIPO_OPORTUNIDADE[item.tipo];
            return (
              <div key={i} className="vgr-card" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ marginBottom: 4 }}>
                    <Badge tone={meta.tone}>{meta.titulo}</Badge>
                  </div>
                  <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{item.titulo}</strong>
                  <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>{item.descricao}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {grupoSelecionado && (
        <div style={{ marginTop: 16 }}>
          <div className="vgr-toolbar" style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CNPJ/CPF…"
              className="vgr-input"
              style={{ flex: 1 }}
            />
            <Button variant="secondary" onClick={exportarCsv}>
              ⇩ Exportar CSV
            </Button>
          </div>
          {parceirosVisiveis.length === 0 ? (
            <Alert tone="info">Nenhuma empresa encontrada para "{busca}".</Alert>
          ) : (
            <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--vgr-border)", borderRadius: "var(--vgr-radius)" }}>
              <table className="vgr-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Regime</th>
                    <th style={{ textAlign: "right" }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parceirosVisiveis.map((p) => (
                    <tr key={p.participante.codPart} className="clickable" onClick={() => setParceiroSelecionado(p)}>
                      <td>
                        <strong>{p.participante.nome}</strong>
                      </td>
                      <td>{LABEL_REGIME_PARCEIRO[p.participante.regime]}</td>
                      <td className="num">{moeda(p.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Drawer
        open={parceiroSelecionado !== null}
        tag={parceiroSelecionado ? LABEL_REGIME_PARCEIRO[parceiroSelecionado.participante.regime] : undefined}
        title={parceiroSelecionado?.participante.nome ?? ""}
        onClose={() => setParceiroSelecionado(null)}
      >
        {parceiroSelecionado && (
          <>
            <DrawerRow label="Documento" value={parceiroSelecionado.participante.cnpj || parceiroSelecionado.participante.cpf || "—"} />
            <DrawerRow label="Papel" value={papel === "fornecedores" ? "Fornecedor" : "Cliente"} />
            <DrawerRow label="Valor total" value={moeda(parceiroSelecionado.valorTotal)} />
            <DrawerRow
              label="Gera crédito integral?"
              value={
                parceiroSelecionado.participante.regime === "desconhecido"
                  ? "Não confirmado"
                  : parceiroSelecionado.participante.restringeCreditoDoCliente
                    ? "Não"
                    : "Sim"
              }
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
