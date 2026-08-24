/**
 * Wizard Estratégico V2 — produz `CenarioEmpresa` diretamente, sem
 * `DadosApuradosCliente` nem `adapters/legadoParaCenarioEmpresa`
 * (seção 3/70 do pedido). Fluxo paralelo ao Wizard legado — não o
 * substitui, não o remove, não redireciona a rota antiga.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Body, Button, Stepper, TopBar } from "../../../design-system";
import { executarAnaliseEstrategica } from "../../../application/analiseEstrategica/motor";
import { useWizardEstrategico } from "../estado";
import { ETAPAS_WIZARD } from "../tipos";
import type { EtapaWizardId, RascunhoCenarioEmpresa } from "../tipos";
import { calcularStatusEtapa } from "../selectors/status";
import { validarRascunho, converterRascunhoParaCenario } from "../validacao";
import { construirOpcoesExecucao } from "../execucao";
import { salvarSnapshotAnalise } from "../persistenciaAnalise";
import { EtapaDocumentos } from "../etapas/EtapaDocumentos";
import { EtapaEmpresa } from "../etapas/EtapaEmpresa";
import { EtapaAtividades } from "../etapas/EtapaAtividades";
import { EtapaReceita } from "../etapas/EtapaReceita";
import { EtapaCustosCreditos } from "../etapas/EtapaCustosCreditos";
import { EtapaPessoasFs12 } from "../etapas/EtapaPessoasFs12";
import { EtapaFiscal } from "../etapas/EtapaFiscal";
import { EtapaCaixaSplit } from "../etapas/EtapaCaixaSplit";
import { EtapaPremissasEstrategicas } from "../etapas/EtapaPremissasEstrategicas";
import { EtapaRevisao } from "../etapas/EtapaRevisao";

const ID_RASCUNHO_PADRAO = "wizard-estrategico-v2";

const ROTULO_STATUS_ETAPA: Record<string, string> = {
  incompleta: "Incompleta",
  completa: "Completa",
  com_ressalvas: "Com ressalvas",
  nao_aplicavel: "Não aplicável",
};

export default function WizardEstrategicoPage() {
  const navigate = useNavigate();
  const { rascunho, dispatch } = useWizardEstrategico(ID_RASCUNHO_PADRAO);
  const [indice, setIndice] = useState(0);
  const [erroExecucao, setErroExecucao] = useState<string | undefined>();
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const etapaAtual = ETAPAS_WIZARD[indice];

  useEffect(() => {
    dispatch({ tipo: "marcarEtapaVisitada", etapa: etapaAtual.id });
  }, [etapaAtual.id, dispatch]);

  useEffect(() => {
    tituloRef.current?.focus();
  }, [indice]);

  const avancar = useCallback(() => setIndice((i) => Math.min(i + 1, ETAPAS_WIZARD.length - 1)), []);
  const voltar = useCallback(() => setIndice((i) => Math.max(i - 1, 0)), []);

  function aoSimular() {
    setErroExecucao(undefined);
    const resultadoValidacao = validarRascunho(rascunho);
    if (!resultadoValidacao.valido) return;
    try {
      const { cenario } = converterRascunhoParaCenario(rascunho);
      const opcoes = construirOpcoesExecucao(rascunho);
      const analise = executarAnaliseEstrategica(cenario, opcoes);
      // Persiste a ENTRADA (rascunho), não o resultado — sobrevive a um reload por reexecução, nunca por snapshot obsoleto (seção 37).
      salvarSnapshotAnalise(rascunho);
      navigate("/analises/estrategica", { state: { analise, nomeEmpresa: cenario.identificacao.nomeEmpresa?.valor } });
    } catch {
      setErroExecucao("Não foi possível executar a análise com os dados atuais. Revise a etapa Fiscal (é preciso ao menos um regime selecionado) e tente novamente.");
    }
  }

  return (
    <>
      <TopBar crumb="Simulador" title="Simulador Estratégico" meta={<span>Wizard V2 — entrada direta em CenarioEmpresa</span>} />
      <Body>
        <p className="vgr-lede">Fluxo paralelo ao simulador atual — captura apenas o que a análise estratégica realmente usa, com qualidade de dados explícita a cada passo.</p>

        <Stepper labels={ETAPAS_WIZARD.map((e) => e.titulo)} currentStep={indice} />
        <p aria-live="polite">
          Etapa {indice + 1} de {ETAPAS_WIZARD.length}: {etapaAtual.titulo} — {ROTULO_STATUS_ETAPA[calcularStatusEtapa(rascunho, etapaAtual.id)]}
        </p>

        <h2 ref={tituloRef} tabIndex={-1} className="vgr-wizard-titulo-etapa">
          {etapaAtual.titulo}
        </h2>

        <EtapaAtual etapa={etapaAtual.id} rascunho={rascunho} dispatch={dispatch} onSimular={aoSimular} />

        {erroExecucao && <Alert tone="danger">{erroExecucao}</Alert>}

        <nav aria-label="Navegação entre etapas" style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={voltar} disabled={indice === 0}>
            ← Voltar
          </Button>
          {etapaAtual.id !== "revisao" && (
            <Button variant="secondary" onClick={avancar} disabled={indice === ETAPAS_WIZARD.length - 1}>
              Avançar →
            </Button>
          )}
        </nav>
      </Body>
    </>
  );
}

function EtapaAtual({
  etapa,
  rascunho,
  dispatch,
  onSimular,
}: {
  etapa: EtapaWizardId;
  rascunho: RascunhoCenarioEmpresa;
  dispatch: ReturnType<typeof useWizardEstrategico>["dispatch"];
  onSimular: () => void;
}) {
  switch (etapa) {
    case "documentos":
      return <EtapaDocumentos rascunho={rascunho} dispatch={dispatch} />;
    case "empresa":
      return <EtapaEmpresa rascunho={rascunho} dispatch={dispatch} />;
    case "atividades":
      return <EtapaAtividades rascunho={rascunho} dispatch={dispatch} />;
    case "receita":
      return <EtapaReceita rascunho={rascunho} dispatch={dispatch} />;
    case "custosCreditos":
      return <EtapaCustosCreditos rascunho={rascunho} dispatch={dispatch} />;
    case "pessoasFs12":
      return <EtapaPessoasFs12 rascunho={rascunho} dispatch={dispatch} />;
    case "fiscal":
      return <EtapaFiscal rascunho={rascunho} dispatch={dispatch} />;
    case "caixaSplit":
      return <EtapaCaixaSplit rascunho={rascunho} dispatch={dispatch} />;
    case "premissasEstrategicas":
      return <EtapaPremissasEstrategicas rascunho={rascunho} dispatch={dispatch} />;
    case "revisao":
      return <EtapaRevisao rascunho={rascunho} dispatch={dispatch} onSimular={onSimular} />;
  }
}
