/**
 * "Leitura Consultiva da Análise" (seção 12/58/59 do pedido) — nunca
 * chamada automaticamente (seção 3); botão explícito. Nunca um chat —
 * uma nota consultiva estruturada, sempre a partir de
 * `RespostaIaConsultiva` já validada pelos guardrails. Renderização
 * SEMPRE por texto React puro (nunca `dangerouslySetInnerHTML` — seção
 * 65/66): a resposta do provedor nunca é HTML executável.
 */

import { useState } from "react";
import { Alert, Badge, Button, Card, DetailToggle, Skeleton, Tabs } from "../../design-system";
import { gerarExplicacaoDaAnalise, calcularContextHashAtual, type ExplicacaoDaAnaliseResultado } from "../../application/iaConsultiva/motor";
import { construirIaConsultivaViewModel } from "../viewModels/iaConsultiva";
import type { AnaliseEstrategicaCompleta } from "../../application/analiseEstrategica/tipos";
import type { NivelComunicacao } from "../../engine/iaConsultiva/tipos";

const NIVEIS: { value: NivelComunicacao; label: string }[] = [
  { value: "executiva", label: "Executiva" },
  { value: "consultiva", label: "Consultiva" },
  { value: "tecnica", label: "Técnica" },
];

const ROTULO_STATUS_TECNICO: Record<string, string> = {
  gerada: "Gerada por provedor de IA",
  fallback: "Fallback determinístico (provedor rejeitado/indisponível)",
  rejeitada: "Resposta do provedor rejeitada pelos guardrails — fallback exibido",
  erro_provedor: "Erro no provedor — fallback exibido",
  indisponivel: "Nenhum provedor de IA configurado — explicação estruturada determinística",
};

export function SecaoIaConsultiva({ analise, onResultadoGerado }: { analise: AnaliseEstrategicaCompleta; onResultadoGerado?: (resultado: ExplicacaoDaAnaliseResultado) => void }) {
  const [nivel, setNivel] = useState<NivelComunicacao>("consultiva");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ExplicacaoDaAnaliseResultado | undefined>();
  const [erro, setErro] = useState<string | undefined>();

  if (!analise.decisao) {
    return (
      <Card title="Leitura consultiva da análise">
        <Alert tone="info">A explicação consultiva não está disponível no momento. Os resultados técnicos da análise permanecem disponíveis nas seções abaixo.</Alert>
      </Card>
    );
  }

  const hashAtual = calcularContextHashAtual(analise);
  const desatualizada = resultado !== undefined && resultado.contextHash !== hashAtual;

  async function gerar() {
    setCarregando(true);
    setErro(undefined);
    try {
      const r = await gerarExplicacaoDaAnalise({ analise });
      setResultado(r);
      if (r) onResultadoGerado?.(r);
    } catch {
      setErro("Não foi possível gerar a leitura consultiva agora. Os resultados técnicos da análise continuam disponíveis normalmente.");
    } finally {
      setCarregando(false);
    }
  }

  if (!resultado) {
    return (
      <Card title="Leitura consultiva da análise">
        <p>Leitura consultiva disponível sob demanda — explica a conclusão já produzida pelos motores, sem alterá-la.</p>
        {erro && <Alert tone="warn">{erro}</Alert>}
        <Button variant="primary" onClick={gerar} disabled={carregando}>
          {carregando ? "Gerando leitura consultiva…" : "Gerar explicação"}
        </Button>
        {carregando && <Skeleton height={60} />}
      </Card>
    );
  }

  const resposta = resultado.respostas[nivel];
  const vm = construirIaConsultivaViewModel(resposta, resultado.contexto, nivel);

  return (
    <Card title="Leitura consultiva da análise">
      {desatualizada && <Alert tone="warn">Esta análise foi recalculada — a leitura abaixo está desatualizada. Gere novamente para refletir os dados atuais.</Alert>}

      <Tabs options={NIVEIS} value={nivel} onChange={setNivel} />

      <h4>{vm.titulo}</h4>
      <p>{vm.resumoExecutivo}</p>

      {nivel !== "executiva" && <p>{vm.explicacao}</p>}

      {vm.condicoes.length > 0 && (
        <Alert tone="warn">
          <strong>Condições da conclusão</strong>
          <ul>
            {vm.condicoes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Alert>
      )}

      {nivel !== "executiva" && vm.evidencias.length > 0 && (
        <DetailToggle label="Ver evidências">
          <ul>
            {vm.evidencias.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </DetailToggle>
      )}

      {vm.pontosAtencao.length > 0 && (
        <div>
          <strong>Pontos de atenção</strong>
          <ul>
            {vm.pontosAtencao.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {vm.validacoesPendentes.length > 0 && (
        <div>
          <strong>Validações pendentes</strong>
          <ul>
            {vm.validacoesPendentes.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {vm.ressalvas.length > 0 && (
        <ul>
          {vm.ressalvas.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {nivel === "tecnica" && vm.metadadosTecnicos && (
        <DetailToggle label="Metadados técnicos">
          <p>Origem: {ROTULO_STATUS_TECNICO[vm.metadadosTecnicos.status] ?? vm.metadadosTecnicos.status}</p>
          <p>Prompt: {vm.metadadosTecnicos.promptVersion}</p>
          {vm.textoTecnico && <p>{vm.textoTecnico}</p>}
        </DetailToggle>
      )}

      <div style={{ marginTop: 12 }}>
        <Badge tone="neutral">{vm.origemGeracao}</Badge>{" "}
        <Button variant="tertiary" onClick={gerar} disabled={carregando}>
          {carregando ? "Gerando…" : "Gerar novamente"}
        </Button>
      </div>
    </Card>
  );
}
