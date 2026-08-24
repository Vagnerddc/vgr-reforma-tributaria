/**
 * Rota estratégica paralela (seção 3/24 do pedido) — NÃO substitui
 * `/analises` (legado). Duas entradas possíveis: (a) `ClienteData`
 * (contexto legado) → adapter isolado → `CenarioEmpresa` →
 * `executarAnaliseEstrategica`; ou (b) uma `AnaliseEstrategicaCompleta`
 * já executada, recebida via `location.state` — usada pelo Wizard
 * Estratégico V2 (`/simulador-estrategico`), que NUNCA passa pelo
 * adapter legado (seção 70/71 da fase de Wizard V2). Nenhum motor é
 * chamado diretamente aqui.
 */

import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useClienteData } from "../context/ClienteDataContext";
import { adaptarClienteLegadoParaCenarioEmpresa } from "../application/analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import { executarAnaliseEstrategica } from "../application/analiseEstrategica/motor";
import type { AnaliseEstrategicaCompleta } from "../application/analiseEstrategica/tipos";
import type { ExplicacaoDaAnaliseResultado } from "../application/iaConsultiva/motor";
import { construirPaginaAnaliseEstrategicaViewModel } from "../presentation/viewModels/analiseEstrategica";
import { construirIaConsultivaViewModel } from "../presentation/viewModels/iaConsultiva";
import { construirApresentacaoExecutivaViewModel } from "../presentation/viewModels/apresentacao";
import { construirMemoriaTecnicaAnalise } from "../application/memoriaTecnica/motor";
import { construirMemoriaTecnicaViewModel } from "../presentation/viewModels/memoriaTecnica";
import { SecaoMemoriaTecnica } from "../presentation/components/SecaoMemoriaTecnica";
import { carregarSnapshotAnalise, limparSnapshotAnalise, statusSnapshotAnalise } from "../features/wizardEstrategico/persistenciaAnalise";
import { converterRascunhoParaCenario } from "../features/wizardEstrategico/validacao";
import { construirOpcoesExecucao } from "../features/wizardEstrategico/execucao";
import { VisaoGeralExecutiva } from "../presentation/components/VisaoGeralExecutiva";
import { ComparacaoRegimesTabela } from "../presentation/components/ComparacaoRegimesTabela";
import { SecaoScoreEstrategico } from "../presentation/components/SecaoScoreEstrategico";
import { SecaoParetoFronteira } from "../presentation/components/SecaoParetoFronteira";
import { SecaoPlanoAcao } from "../presentation/components/SecaoPlanoAcao";
import { SecaoImpactoCaixa } from "../presentation/components/SecaoImpactoCaixa";
import { TimelineEstrategica } from "../presentation/components/TimelineEstrategica";
import { SecaoPontosVirada } from "../presentation/components/SecaoPontosVirada";
import { SecaoIaConsultiva } from "../presentation/components/SecaoIaConsultiva";
import { ModoApresentacao } from "../presentation/components/apresentacao/ModoApresentacao";
import { TopBar, Body, EmptyState, Button, Alert, Badge } from "../design-system";
import { motorLucroPresumido } from "../engine/motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../engine/motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../engine/motorRegimes/lucroReal/motor";

const MOTORES_REGIME = [motorLucroPresumido, motorSimplesUnificado, motorLucroReal];

interface EstadoNavegacaoWizardV2 {
  analise?: AnaliseEstrategicaCompleta;
  nomeEmpresa?: string;
}

export default function AnaliseEstrategica() {
  const { cliente } = useClienteData();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [iaResultado, setIaResultado] = useState<ExplicacaoDaAnaliseResultado | undefined>();

  const estadoWizardV2 = location.state as EstadoNavegacaoWizardV2 | null;

  // Sem location.state (ex.: reload de página), tenta restaurar a partir do snapshot V2 persistido — reexecutando a
  // análise a partir da entrada guardada (cenário + opções), nunca de um resultado congelado (seção 34-37 da fase de validação).
  const restauradoDeSnapshot = useMemo(() => {
    if (estadoWizardV2?.analise) return undefined;
    const snapshot = carregarSnapshotAnalise();
    if (!snapshot) return undefined;
    try {
      const { cenario } = converterRascunhoParaCenario(snapshot.entrada);
      const opcoes = construirOpcoesExecucao(snapshot.entrada);
      return { analise: executarAnaliseEstrategica(cenario, opcoes), nomeEmpresa: cenario.identificacao.nomeEmpresa?.valor };
    } catch {
      return undefined;
    }
  }, [estadoWizardV2]);

  const adaptado = useMemo(() => (cliente ? adaptarClienteLegadoParaCenarioEmpresa(cliente) : undefined), [cliente]);

  // Execução síncrona: todos os motores de domínio são funções puras síncronas — sem infraestrutura de job/fila (seção 34 do pedido).
  // Prioridade: (1) análise já pronta via location.state (navegação recente do Wizard V2); (2) snapshot V2 restaurado após reload;
  // (3) fluxo legado via ClienteData/adapter. As duas primeiras nunca recalculam o que o Wizard V2 já executou.
  const analise = useMemo(
    () => estadoWizardV2?.analise ?? restauradoDeSnapshot?.analise ?? (adaptado ? executarAnaliseEstrategica(adaptado.cenario, { motoresRegime: MOTORES_REGIME, incluirHorizonte: true }) : undefined),
    [estadoWizardV2, restauradoDeSnapshot, adaptado],
  );

  const nomeEmpresaEfetivo = estadoWizardV2?.nomeEmpresa ?? restauradoDeSnapshot?.nomeEmpresa ?? cliente?.nomeEmpresa;
  const origemWizardV2 = Boolean(estadoWizardV2?.analise || restauradoDeSnapshot);

  const vm = useMemo(() => (analise ? construirPaginaAnaliseEstrategicaViewModel(analise, nomeEmpresaEfetivo) : undefined), [analise, nomeEmpresaEfetivo]);

  // Memória Técnica: reconstrói a trilha de auditoria dos resultados já produzidos — nunca recalcula (seção 1/2 do pedido).
  const memoria = useMemo(
    () => (analise ? construirMemoriaTecnicaAnalise(analise, { perdasLegado: adaptado?.perdas, iaResposta: iaResultado?.respostas.consultiva }) : undefined),
    [analise, adaptado, iaResultado],
  );
  const memoriaVm = useMemo(() => (memoria ? construirMemoriaTecnicaViewModel(memoria) : undefined), [memoria]);

  const modoApresentacao = searchParams.get("modo") === "apresentacao";
  const secaoInicial = Number(searchParams.get("secao") ?? "0") || 0;

  if (!analise || !vm) {
    // Snapshot presente mas inválido/corrompido: nunca ignorado silenciosamente — mensagem própria e caminho de volta ao Wizard V2 (seção 42).
    const snapshotCorrompido = !estadoWizardV2?.analise && statusSnapshotAnalise() === "invalido";
    return (
      <>
        <TopBar crumb="Análises" title="Análise estratégica" />
        <Body>
          <EmptyState
            icon="◆"
            title={snapshotCorrompido ? "Não foi possível restaurar a análise anterior" : "Nenhuma análise estratégica disponível"}
            description={
              snapshotCorrompido
                ? "O snapshot salvo do Simulador Estratégico ficou inválido ou incompatível — nada foi carregado silenciosamente. Gere uma nova análise no Simulador Estratégico."
                : "Importe os arquivos fiscais e conclua a simulação para gerar a análise estratégica — ela reaproveita os mesmos dados já informados no simulador."
            }
            action={
              <Link to={snapshotCorrompido ? "/simulador-estrategico" : "/importar"}>
                <Button variant="primary">{snapshotCorrompido ? "Abrir Simulador Estratégico" : "Importar arquivos"}</Button>
              </Link>
            }
          />
        </Body>
      </>
    );
  }

  if (analise.statusRegimesComparador.status === "erro") {
    return (
      <>
        <TopBar crumb="Análises" title="Análise estratégica" meta={<span>{nomeEmpresaEfetivo}</span>} />
        <Body>
          <Alert tone="danger">Não foi possível concluir a análise estratégica. {analise.statusRegimesComparador.motivo} O resultado tradicional continua disponível em Análises.</Alert>
        </Body>
      </>
    );
  }

  if (modoApresentacao) {
    // A explicação de IA só é incluída se JÁ tiver sido gerada antes (seção 3/40/75) — nunca disparada aqui.
    const iaVm = iaResultado ? construirIaConsultivaViewModel(iaResultado.respostas.consultiva, iaResultado.contexto, "consultiva") : undefined;
    const apresentacaoVm = construirApresentacaoExecutivaViewModel(vm, iaVm);
    return (
      <ModoApresentacao
        vm={apresentacaoVm}
        indiceInicial={secaoInicial}
        onSair={(indiceAtual) => {
          const proximos = new URLSearchParams(searchParams);
          proximos.delete("modo");
          proximos.delete("secao");
          setSearchParams(proximos);
          void indiceAtual;
        }}
        onAbrirMemoriaTecnica={() => {
          const proximos = new URLSearchParams(searchParams);
          proximos.delete("modo");
          proximos.delete("secao");
          setSearchParams(proximos);
        }}
      />
    );
  }

  return (
    <>
      <TopBar
        crumb="Análises"
        title="Análise estratégica"
        meta={
          <span>
            {nomeEmpresaEfetivo} · {vm.ano}
          </span>
        }
        actions={
          <>
            <Badge tone="info">Experimental</Badge>{" "}
            {origemWizardV2 && (
              <Button
                variant="tertiary"
                onClick={() => {
                  limparSnapshotAnalise();
                  navigate("/simulador-estrategico");
                }}
              >
                Nova análise
              </Button>
            )}{" "}
            <Button variant="secondary" onClick={() => setSearchParams({ modo: "apresentacao" })}>
              Apresentar análise
            </Button>
          </>
        }
      />
      <Body>
        <p className="vgr-lede">Consolidação do pipeline estratégico completo — regimes, comparador, econômico-financeiro, achados, estratégia, decisão, plano de ação e score.</p>

        {origemWizardV2 && (
          <Alert tone="info">
            Esta análise foi produzida pelo Simulador Estratégico (Wizard V2) — entrada direta em CenarioEmpresa, sem o adapter legado.
            {restauradoDeSnapshot && " Restaurada após reload a partir da entrada salva — reexecutada, não é um resultado congelado."}
          </Alert>
        )}

        {adaptado && adaptado.perdas.length > 0 && (
          <Alert tone="info">
            Esta análise foi adaptada dos dados já importados no simulador legado. Não foram capturados: {adaptado.perdas.map((p) => p.campo).join("; ")}.
          </Alert>
        )}

        {vm.resumo && vm.decisao ? (
          <VisaoGeralExecutiva resumo={vm.resumo} decisao={vm.decisao} />
        ) : (
          <Alert tone="warn">Ainda não há decisão/resumo disponíveis para esta análise — {analise.statusDecisao.motivo ?? "dados insuficientes."}</Alert>
        )}

        <SecaoIaConsultiva analise={analise} onResultadoGerado={setIaResultado} />

        <ComparacaoRegimesTabela linhas={vm.comparacaoRegimes} />

        <SecaoImpactoCaixa vm={vm.caixa} />

        {vm.timeline && <TimelineEstrategica vm={vm.timeline} />}

        <SecaoPontosVirada pontos={vm.pontosVirada} />

        {vm.scores && <SecaoScoreEstrategico scores={vm.scores} />}
        {vm.planoAcao && <SecaoPlanoAcao etapas={vm.planoAcao.etapas} />}

        {vm.pareto ? <SecaoParetoFronteira vm={vm.pareto} /> : <Alert tone="info">{vm.statusOtimizacaoMotivo ?? "Otimização não executada nesta análise."}</Alert>}

        {memoriaVm && <SecaoMemoriaTecnica vm={memoriaVm} />}
      </Body>
    </>
  );
}
