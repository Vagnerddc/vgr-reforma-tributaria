import { useEffect, useMemo, useState } from "react";
import { useClienteData } from "../context/ClienteDataContext";
import { simular } from "../engine/calculo";
import type { Regime, MeioPagamento, AnexoSimples, TipoOperacaoConstrucao, SimulacaoInput } from "../engine/types";
import { LABEL_PERFIL, type PerfilAtividade } from "../engine/atividades";
import { parametros } from "../engine/parametros";
import { decodificarArquivosOuZip } from "../engine/sped/zip";
import {
  agregarDadosCliente,
  aplicarEnriquecimentoParticipantes,
  enriquecerRegimeParceiros,
  type DadosApuradosCliente,
} from "../engine/sped/agregador";
import type { Participante } from "../engine/sped/tipos";
import { faturamentoParaMargemAlvo, projetarInputDoSped, sugerirPercentualComprasProdutorRuralNaoContribuinte } from "../engine/projecao";
import { apurarMetodologiaMultiAno, sintetizarDadosParaProjecao, type AnoApurado } from "../engine/metodologiaMultiAno";
import { aplicarReclassificacaoSegmento } from "../engine/reclassificacaoSegmento";
import { extrairDadosDrePdf } from "../engine/dre/extrairDrePdf";
import { mesclarDespesasDoDreComPrecedencia, type DadosDrePdf } from "../engine/dre/parseTextoDre";
import { gerarPanorama, type Panorama } from "../engine/panorama";
import { pisCofinsAutomatico, icmsAutomatico } from "../engine/tributosAtuais";
import { CampoMoeda, CampoPercentual } from "../lib/campos";
import { SimuladorWizard } from "../components/SimuladorWizard";
import type { CustosDespesasResultado } from "../components/CustosDespesasStep";
import { ResultadoExecutivo } from "../components/ResultadoExecutivo";
import logoVgrSvgTexto from "../assets/vgr/logo-vgr.svg?raw";
import { gerarApresentacaoHtml } from "../engine/apresentacao/gerarApresentacaoHtml";
import {
  TopBar,
  Body,
  Badge,
  Button,
  Alert,
  Tabs,
  FileDropzone,
  ProcessingState,
  EmptyState,
  Tooltip,
  Field,
  Select,
} from "../design-system";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

type ModoProjecao = "crescimento" | "margem";

const ANOS_SUPORTADOS = [2025, 2026] as const;

function dedupeParticipantes(listas: Participante[][]): Participante[] {
  const mapa = new Map<string, Participante>();
  for (const lista of listas) {
    for (const p of lista) {
      const chave = p.cnpj || p.cpf || p.codPart;
      if (!mapa.has(chave)) mapa.set(chave, p);
    }
  }
  return Array.from(mapa.values());
}

interface ArquivoDecodificado {
  nomeArquivo: string;
  conteudo: string;
}

export default function ImportarSped() {
  // Arquivos SPED decodificados, ACUMULADOS por ano — cada novo upload para o
  // mesmo ano soma aos anteriores (ex.: importar EFD de janeiro e depois de
  // fevereiro cobre os dois meses, não substitui um pelo outro). dadosPorAno
  // (mais abaixo) é sempre recalculado a partir desse acumulado, nunca setado
  // diretamente — isso é o que corrige o bug de "novo upload apaga o anterior".
  const [arquivosDecodificadosPorAno, setArquivosDecodificadosPorAno] = useState<
    Partial<Record<number, ArquivoDecodificado[]>>
  >({});
  const [faturamentoRealPorAno, setFaturamentoRealPorAno] = useState<Partial<Record<number, number>>>({});
  const [processando, setProcessando] = useState(false);
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const [consultandoRegimes, setConsultandoRegimes] = useState(false);
  const [progressoRegimes, setProgressoRegimes] = useState<{ feitos: number; total: number } | null>(null);
  const [dreExtraidoPorAno, setDreExtraidoPorAno] = useState<Partial<Record<number, DadosDrePdf>>>({});
  const [processandoDre, setProcessandoDre] = useState<number | null>(null);
  // Regimes/CNAE já consultados na Receita Federal, persistidos por chave (CNPJ/CPF/codPart)
  // — sobrevive a novos uploads de arquivo (que recalculam dadosPorAno do zero a partir do
  // acumulado), diferente de um enriquecimento aplicado só uma vez em cima do estado antigo.
  const [enriquecimentoPorChave, setEnriquecimentoPorChave] = useState<Map<string, Participante>>(new Map());

  const dadosPorAnoBase: Partial<Record<number, DadosApuradosCliente>> = useMemo(() => {
    const resultado: Partial<Record<number, DadosApuradosCliente>> = {};
    for (const ano of ANOS_SUPORTADOS) {
      const arquivos = arquivosDecodificadosPorAno[ano];
      if (!arquivos || arquivos.length === 0) continue;
      let agregado = agregarDadosCliente(arquivos);
      agregado = aplicarEnriquecimentoParticipantes(agregado, enriquecimentoPorChave);
      const dre = dreExtraidoPorAno[ano];
      if (dre) agregado = mesclarDespesasDoDreComPrecedencia(agregado, dre);
      resultado[ano] = agregado;
    }
    return resultado;
  }, [arquivosDecodificadosPorAno, enriquecimentoPorChave, dreExtraidoPorAno]);
  const dadosPorAno = dadosPorAnoBase;

  const anosApurados: AnoApurado[] = ANOS_SUPORTADOS.filter((ano) => dadosPorAno[ano]).map((ano) => ({
    ano,
    dados: dadosPorAno[ano]!,
    faturamentoReal: faturamentoRealPorAno[ano] ?? 0,
  }));

  const metodologia = useMemo(
    () => (anosApurados.length > 0 ? apurarMetodologiaMultiAno(anosApurados) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dadosPorAno, faturamentoRealPorAno]
  );

  const [perfil, setPerfil] = useState<PerfilAtividade>("aviacao_agricola");

  const dados: DadosApuradosCliente | null = useMemo(() => {
    if (!metodologia) return null;
    const sintetizado = sintetizarDadosParaProjecao(anosApurados, metodologia);
    return aplicarReclassificacaoSegmento(sintetizado, perfil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosPorAno, faturamentoRealPorAno, perfil]);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [regimeAtual, setRegimeAtual] = useState<Regime>("lucro_real");
  const [anexoSimples, setAnexoSimples] = useState<AnexoSimples>("anexoIII");
  const [tipoAviacao, setTipoAviacao] = useState<"convencional" | "drone">("convencional");
  const [tipoOperacaoConstrucao, setTipoOperacaoConstrucao] = useState<TipoOperacaoConstrucao>("empreitada");
  const [percentualClienteContribuinte, setPercentualClienteContribuinte] = useState(70);
  // P0.2: estado independente de percentualComprasProdutorRural (calculado abaixo) —
  // se as compras de produtor rural recalcularem para 0% (ex.: ano sem esse tipo de
  // fornecedor), o campo só fica oculto na UI, mas o valor customizado aqui NUNCA é
  // resetado nem reaproveitado como padrão em outro lugar: volta a valer sozinho se
  // as compras de produtor rural reaparecerem num recálculo futuro.
  const [percentualCreditoPresumidoProdutorRural, setPercentualCreditoPresumidoProdutorRural] = useState(
    parametros.produtorRural.creditoPresumidoComprasDeNaoContribuinte * 100
  );
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>("pix");

  // % de compras de produtor rural não contribuinte: o SPED já identifica quem é
  // pessoa física (fornecedor sem CNPJ) — não é algo para o contador estimar, é
  // calculado direto da exposição real. Só a % de crédito PRESUMIDO sobre essas
  // compras (abaixo) precisa de confirmação, pois a lei não a fixa.
  const percentualComprasProdutorRural = useMemo(
    () => (dados ? sugerirPercentualComprasProdutorRuralNaoContribuinte(dados) * 100 : 0),
    [dados]
  );

  const [modoProjecao, setModoProjecao] = useState<ModoProjecao>("margem");
  const [taxaCrescimento, setTaxaCrescimento] = useState(5);
  const [margemAlvo, setMargemAlvo] = useState(3);

  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [resultadoSimulacao, setResultadoSimulacao] = useState<ReturnType<typeof simular> | null>(null);
  const [avisoMeta, setAvisoMeta] = useState<string | null>(null);

  // Jornada em fases (Importação → Simulador → Processamento → Resultado) — cada
  // fase tem sua própria tela, nunca disputando espaço com a anterior. Nenhuma
  // fase recalcula nada: só controla qual seção é exibida.
  const [fase, setFase] = useState<"importar" | "wizard" | "processando" | "resultado">("importar");
  const [anoAtivo, setAnoAtivo] = useState<(typeof ANOS_SUPORTADOS)[number]>(2026);

  // Origem dos dados da simulação: SPED importado (fluxo de sempre) ou dados
  // manuais (mesmos campos que existiam em /simulador-interno, sem exigir
  // nenhum arquivo). Os dois convergem no mesmo wizard e na mesma tela de
  // Resultado — só a etapa inicial muda.
  const [origemDados, setOrigemDados] = useState<"sped" | "manual" | null>(null);
  const [ufManual, setUfManual] = useState("SP");
  const [faturamentoAnualManual, setFaturamentoAnualManual] = useState(0);
  const [pisCofinsManualPct, setPisCofinsManualPct] = useState(3.65);
  const [icmsIpiManualPct, setIcmsIpiManualPct] = useState(2.5);
  const [percentualCustosCreditaveisManual, setPercentualCustosCreditaveisManual] = useState(30);
  const [pisCofinsAjustadoManualmente, setPisCofinsAjustadoManualmente] = useState(false);
  const [icmsAjustadoManualmente, setIcmsAjustadoManualmente] = useState(false);
  // Resultado do passo "Custos e despesas" do wizard (Etapa G) — só usado
  // quando o usuário efetivamente informa algo nele; se ficar vazio, cai no
  // percentualCustosCreditaveisManual simples de sempre (compatibilidade).
  const [custosDespesasResultado, setCustosDespesasResultado] = useState<CustosDespesasResultado | null>(null);

  useEffect(() => {
    if (origemDados !== "manual" || pisCofinsAjustadoManualmente) return;
    const sugestao = pisCofinsAutomatico(regimeAtual, anexoSimples);
    setPisCofinsManualPct(Number((sugestao.aliquota * 100).toFixed(4)));
  }, [origemDados, regimeAtual, anexoSimples, pisCofinsAjustadoManualmente]);

  useEffect(() => {
    if (origemDados !== "manual" || icmsAjustadoManualmente || !ufManual) return;
    const sugestao = icmsAutomatico(ufManual, perfil);
    setIcmsIpiManualPct(Number((sugestao.aliquota * 100).toFixed(4)));
  }, [origemDados, ufManual, perfil, icmsAjustadoManualmente]);

  const icmsSugeridoManual = origemDados === "manual" ? icmsAutomatico(ufManual, perfil) : null;

  // Dados sintéticos equivalentes a um DadosApuradosCliente, só para o modo
  // manual poder alimentar o MESMO wizard/Resultado do fluxo SPED sem
  // duplicar nenhuma tela — não vem de nenhum arquivo, é só o reflexo dos
  // campos manuais preenchidos abaixo. Nunca reclassificado por segmento
  // (não há conta contábil para reclassificar).
  const dadosManuais: DadosApuradosCliente | null = useMemo(() => {
    if (origemDados !== "manual" || faturamentoAnualManual <= 0) return null;
    return {
      participantes: [],
      faturamento: faturamentoAnualManual,
      custoMercadoriaInsumo: 0,
      despesaOperacional: 0,
      despesaAdministrativa: 0,
      usoConsumo: 0,
      imobilizado: 0,
      outros: 0,
      tributosRecolhidos: {
        icms: faturamentoAnualManual * (icmsIpiManualPct / 100),
        pis: faturamentoAnualManual * (pisCofinsManualPct / 100),
        cofins: 0,
      },
      fonteDespesas: "efd_parcial",
      avisos: [
        "Simulação com dados inseridos manualmente — sem detalhamento de despesas por conta contábil nem exposição por fornecedor (isso só está disponível importando os arquivos fiscais).",
      ],
      arquivosProcessados: [],
      parceirosComExposicao: [],
      saldosContabeisDetalhados: [],
      faturamentoPorRegimeProduto: { faturamentoZero: 0, faturamentoReduzido60: 0, faturamentoAliquotaCheia: faturamentoAnualManual, itensIdentificados: [] },
    };
  }, [origemDados, faturamentoAnualManual, icmsIpiManualPct, pisCofinsManualPct]);

  // dadosEfetivos é o que alimenta o wizard/Resultado, venha do SPED ou do
  // preenchimento manual — o resto da tela não precisa saber a diferença.
  const dadosEfetivos = origemDados === "manual" ? dadosManuais : dados;

  const isSimples = regimeAtual === "simples_unificado" || regimeAtual === "simples_hibrido";

  async function handleArquivos(ano: number, arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setProcessando(true);
    setErroImportacao(null);
    setPanorama(null);
    setResultadoSimulacao(null);
    try {
      const decodificados = await decodificarArquivosOuZip(Array.from(arquivos));
      if (decodificados.length === 0) {
        setErroImportacao("Nenhum arquivo de texto reconhecido — se enviou um .zip, confirme que ele contém os .txt do SPED.");
        return;
      }
      // Acumula com o que já foi importado para esse ano (ex.: EFD de janeiro
      // já importada + agora fevereiro) — nunca substitui. Arquivos com o
      // mesmo nome de um já importado são substituídos (reimportação do mesmo
      // arquivo), não duplicados.
      setArquivosDecodificadosPorAno((atual) => {
        const existentes = atual[ano] ?? [];
        const semRepetidos = existentes.filter((e) => !decodificados.some((d) => d.nomeArquivo === e.nomeArquivo));
        return { ...atual, [ano]: [...semRepetidos, ...decodificados] };
      });
    } catch (e) {
      setErroImportacao(e instanceof Error ? e.message : "Falha ao processar os arquivos importados.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleDrePdf(ano: number, arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    if (!dadosPorAno[ano]) {
      setErroImportacao(`Importe primeiro os arquivos SPED de ${ano} (EFD ICMS/IPI e EFD Contribuições) — o DRE só substitui as despesas, o faturamento e os tributos continuam vindo das EFDs.`);
      return;
    }
    setProcessandoDre(ano);
    setErroImportacao(null);
    try {
      const dre = await extrairDadosDrePdf(arquivo);
      setDreExtraidoPorAno((atual) => ({ ...atual, [ano]: dre }));
    } catch (e) {
      setErroImportacao(e instanceof Error ? e.message : "Falha ao processar o PDF do DRE.");
    } finally {
      setProcessandoDre(null);
    }
  }

  async function handleConsultarRegimes() {
    if (anosApurados.length === 0) return;
    const uniao = dedupeParticipantes(anosApurados.map((a) => a.dados.participantes));
    setConsultandoRegimes(true);
    setProgressoRegimes({ feitos: 0, total: uniao.filter((p) => p.cnpj).length });
    try {
      const enriquecidos = await enriquecerRegimeParceiros(uniao, (feitos, total) => setProgressoRegimes({ feitos, total }));
      setEnriquecimentoPorChave((atual) => {
        const novo = new Map(atual);
        for (const p of enriquecidos) novo.set(p.cnpj || p.cpf || p.codPart, p);
        return novo;
      });
    } finally {
      setConsultandoRegimes(false);
    }
  }

  function handleProjetarESimular() {
    setAvisoMeta(null);

    // Modo manual: mesma lógica que /simulador-interno sempre usou — monta o
    // SimulacaoInput direto dos campos informados, sem projeção de faturamento
    // (o próprio simular() já escalona a carga ano a ano) e sem detecção de
    // produtor rural (não há participantes/SPED para detectar).
    if (origemDados === "manual") {
      if (!dadosManuais) return;
      // Se o usuário informou algo no passo "Custos e despesas" (Etapa G), usa
      // os percentuais derivados por sistema tributário; senão cai no
      // percentual único simples de sempre — compatibilidade, nunca some.
      const usaCustosDetalhados = (custosDespesasResultado?.somaGastosInformados ?? 0) > 0;
      const input: SimulacaoInput = {
        nomeEmpresa,
        perfil,
        regimeAtual,
        ...(isSimples ? { anexoSimples } : {}),
        ...(perfil === "aviacao_agricola" ? { tipoAviacao } : {}),
        ...(perfil === "construcao_civil" ? { tipoOperacaoConstrucao } : {}),
        faturamentoAnual: faturamentoAnualManual,
        pisCofinsPercentualAtual: pisCofinsManualPct / 100,
        icmsIpiPercentualAtual: icmsIpiManualPct / 100,
        percentualCustosCreditaveis: percentualCustosCreditaveisManual / 100,
        ...(usaCustosDetalhados
          ? {
              percentualCustosCreditaveisSistemaAtual: custosDespesasResultado!.agregacaoSistemaAtual.percentualCreditavel,
              percentualCustosCreditaveisNovoSistema: custosDespesasResultado!.agregacaoNovoSistema.percentualCreditavel,
            }
          : {}),
        perfilClientes: {
          percentualClienteContribuinte: percentualClienteContribuinte / 100,
          percentualClienteNaoContribuinte: 1 - percentualClienteContribuinte / 100,
        },
        meioPagamentoPredominante: meioPagamento,
      };
      const resultado = simular(input);
      setResultadoSimulacao(resultado);
      setPanorama(gerarPanorama(dadosManuais, input, resultado));
      return;
    }

    if (!dados) return;

    let faturamentoProjetado: number;
    if (modoProjecao === "margem") {
      const resolucao = faturamentoParaMargemAlvo(dados, margemAlvo / 100, parametros.anos.inicioCobrancaEfetiva);
      if (!resolucao.atingivel) {
        setAvisoMeta(
          "Essa meta de margem não é possível de alcançar só aumentando o faturamento com as despesas atuais — a alíquota da reforma já consome mais do que a margem pedida. Tente uma meta menor ou reveja as despesas."
        );
      }
      faturamentoProjetado = resolucao.faturamentoProjetado;
    } else {
      faturamentoProjetado = dados.faturamento * (1 + taxaCrescimento / 100);
    }

    const input = projetarInputDoSped(
      dados,
      {
        nomeEmpresa,
        perfil,
        regimeAtual,
        ...(isSimples ? { anexoSimples } : {}),
        ...(perfil === "aviacao_agricola" ? { tipoAviacao } : {}),
        ...(perfil === "construcao_civil" ? { tipoOperacaoConstrucao } : {}),
        perfilClientes: {
          percentualClienteContribuinte: percentualClienteContribuinte / 100,
          percentualClienteNaoContribuinte: 1 - percentualClienteContribuinte / 100,
        },
        meioPagamentoPredominante: meioPagamento,
        percentualComprasProdutorRuralNaoContribuinte: percentualComprasProdutorRural / 100,
        percentualCreditoPresumidoProdutorRural: percentualCreditoPresumidoProdutorRural / 100,
      },
      faturamentoProjetado
    );
    const resultado = simular(input);
    setResultadoSimulacao(resultado);
    setPanorama(gerarPanorama(dados, input, resultado));
  }

  // Mostra a fase de processamento por um instante antes do Resultado — a
  // simulação em si (handleProjetarESimular) é síncrona e não muda em nada;
  // isso é só a jornada visual aprovada (Processar → processando → Resultado).
  function handleProcessarSimulacao() {
    setFase("processando");
    setTimeout(() => {
      handleProjetarESimular();
      setFase("resultado");
    }, 500);
  }

  function handleGerarApresentacao() {
    if (!dadosEfetivos || !panorama || !resultadoSimulacao) return;
    const html = gerarApresentacaoHtml({
      nomeEmpresa,
      logoSvg: logoVgrSvgTexto,
      dados: dadosEfetivos,
      panorama,
      resultado: resultadoSimulacao,
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  // Publica os mesmos objetos já computados aqui (dados/resultadoSimulacao/panorama)
  // para o Dashboard e as demais telas executivas lerem — sem recalcular nada,
  // só compartilhando o resultado desta apuração (evita uma segunda implementação
  // do cálculo em outra tela). dadosEfetivos cobre os dois fluxos (SPED ou manual).
  const { setCliente } = useClienteData();
  useEffect(() => {
    if (!dadosEfetivos) {
      setCliente(null);
      return;
    }
    setCliente({ nomeEmpresa: nomeEmpresa || "Cliente sem nome", dados: dadosEfetivos, resultadoSimulacao, panorama });
  }, [dadosEfetivos, nomeEmpresa, resultadoSimulacao, panorama, setCliente]);

  const empresaLabel = nomeEmpresa || "Novo cliente";
  const dadosAnoAtivo = dadosPorAno[anoAtivo];

  return (
    <>
      {fase === "importar" && (
        <>
          <TopBar
            crumb="Importação"
            title="Dados fiscais e contábeis"
            meta={<span>{empresaLabel} · análise tributária</span>}
          />
          <Body>
            {origemDados === null && (
              <>
                <p className="vgr-lede">Como você quer simular a carga tributária desta empresa?</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, maxWidth: 640 }}>
                  <button className="vgr-card" style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--vgr-border)" }} onClick={() => setOrigemDados("sped")}>
                    <strong style={{ display: "block", fontSize: 13.5, marginBottom: 6 }}>⇪ Importar arquivos fiscais</strong>
                    <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>
                      Recomendado. Usa EFD, ECD/ECF reais do cliente — detecta produtor rural, exposição por fornecedor e conferência EFD × ECD automaticamente.
                    </p>
                  </button>
                  <button className="vgr-card" style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--vgr-border)" }} onClick={() => setOrigemDados("manual")}>
                    <strong style={{ display: "block", fontSize: 13.5, marginBottom: 6 }}>✎ Inserir dados manualmente</strong>
                    <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", margin: 0 }}>
                      Estimativa rápida sem precisar dos arquivos fiscais — faturamento e alíquotas atuais informados à mão.
                    </p>
                  </button>
                </div>
              </>
            )}

            {origemDados === "manual" && (
              <>
                <Button variant="tertiary" onClick={() => setOrigemDados(null)} style={{ paddingLeft: 0, marginBottom: 8 }}>
                  ← Trocar forma de entrada
                </Button>
                <p className="vgr-lede">Dados atuais da empresa, para calcular a carga tributária de hoje e projetar o sistema novo.</p>
                <div className="vgr-phase-card" style={{ maxWidth: 520 }}>
                  <Field label="Setor de atividade">
                    <Select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilAtividade)}>
                      {Object.entries(LABEL_PERFIL).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>{rotulo}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="UF do estabelecimento">
                    <Select value={ufManual} onChange={(e) => setUfManual(e.target.value)}>
                      {UFS.map((sigla) => (
                        <option key={sigla} value={sigla}>{sigla}</option>
                      ))}
                    </Select>
                  </Field>
                  <CampoMoeda label="Faturamento anual (R$)" value={faturamentoAnualManual} onChange={setFaturamentoAnualManual} />
                  <CampoPercentual
                    label="PIS/COFINS atual (% do faturamento) — ou DAS, se Simples"
                    value={pisCofinsManualPct}
                    onChange={(v) => {
                      setPisCofinsManualPct(v);
                      setPisCofinsAjustadoManualmente(true);
                    }}
                  />
                  <p className="vgr-field-hint">
                    {pisCofinsAjustadoManualmente ? (
                      <>Valor ajustado manualmente. <Button variant="tertiary" onClick={() => setPisCofinsAjustadoManualmente(false)}>Usar automático</Button></>
                    ) : (
                      "Preenchido automaticamente conforme o regime tributário — ajuste os campos de regime na próxima etapa."
                    )}
                  </p>
                  <CampoPercentual
                    label={`ICMS/IPI atual (% do faturamento) — ref. ${ufManual}`}
                    value={icmsIpiManualPct}
                    onChange={(v) => {
                      setIcmsIpiManualPct(v);
                      setIcmsAjustadoManualmente(true);
                    }}
                  />
                  <p className="vgr-field-hint">
                    {icmsAjustadoManualmente ? (
                      <>Valor ajustado manualmente. <Button variant="tertiary" onClick={() => setIcmsAjustadoManualmente(false)}>Usar automático</Button></>
                    ) : (
                      "Preenchido automaticamente conforme a UF — confirme sempre com sua contabilidade."
                    )}
                  </p>
                  {icmsSugeridoManual && <Alert tone="warn">⚠ {icmsSugeridoManual.observacao}</Alert>}
                  <CampoPercentual
                    label="Custos/insumos creditáveis (% do faturamento)"
                    value={percentualCustosCreditaveisManual}
                    onChange={setPercentualCustosCreditaveisManual}
                  />
                  <Button
                    variant="primary"
                    disabled={faturamentoAnualManual <= 0}
                    onClick={() => setFase("wizard")}
                    style={{ marginTop: 8 }}
                  >
                    Continuar para a simulação →
                  </Button>
                </div>
              </>
            )}

            {origemDados === "sped" && (
              <>
            <Button variant="tertiary" onClick={() => setOrigemDados(null)} style={{ paddingLeft: 0, marginBottom: 8 }}>
              ← Trocar forma de entrada
            </Button>
            <p className="vgr-lede">
              Envie os arquivos fiscais e contábeis utilizados na análise.{" "}
              <Tooltip label="EFD ICMS/IPI, EFD Contribuições, ECD e/ou ECF (ou um .zip com todos). Informe também o faturamento real de cada ano — muitas vezes maior que o declarado no SPED — para que a carga tributária, as despesas e o crescimento reflitam a realidade. Tudo processado no seu navegador; nenhum arquivo é enviado para fora.">
                <span style={{ textDecoration: "none" }}>Como funciona a importação</span>
              </Tooltip>
            </p>

            <Tabs options={ANOS_SUPORTADOS.map((a) => ({ value: a, label: String(a) }))} value={anoAtivo} onChange={setAnoAtivo} />

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "flex-start" }}>
              <div>
                <FileDropzone
                  label={`Importar dados de ${anoAtivo}`}
                  hint="Formatos aceitos: EFD ICMS/IPI · EFD Contribuições · ECD · ECF · ZIP"
                  accept=".txt,.zip"
                  multiple
                  disabled={processando}
                  onFiles={(files) => handleArquivos(anoAtivo, files)}
                />

                {dadosAnoAtivo && dadosAnoAtivo.arquivosProcessados.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {dadosAnoAtivo.arquivosProcessados.map((a, i) => (
                      <div key={i} className="vgr-filecard">
                        <span className="ext">{a.tipo}</span>
                        <span className="name">{a.nomeArquivo}</span>
                        <Badge tone="accent">✓ Importado</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {processando && <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", marginTop: 10 }}>Lendo os arquivos…</p>}
                {erroImportacao && (
                  <div style={{ marginTop: 12 }}>
                    <Alert tone="danger">⚠ {erroImportacao}</Alert>
                  </div>
                )}

                {dadosAnoAtivo && (
                  <div style={{ marginTop: 18 }}>
                    <CampoMoeda
                      label={`Faturamento real de ${anoAtivo} (R$)`}
                      value={faturamentoRealPorAno[anoAtivo] ?? 0}
                      onChange={(v) => setFaturamentoRealPorAno((atual) => ({ ...atual, [anoAtivo]: v }))}
                      placeholder={moeda(dadosAnoAtivo.faturamento)}
                    />
                    <p className="vgr-field-hint">Faturamento declarado no SPED: {moeda(dadosAnoAtivo.faturamento)}.</p>

                    {dadosAnoAtivo.fonteDespesas !== "ecd" && (
                      <div style={{ marginTop: 16 }}>
                        <FileDropzone
                          label={`DRE em PDF de ${anoAtivo} (opcional)`}
                          hint="Sem ECD/ECF? O DRE substitui só as despesas — faturamento e tributos continuam vindo das EFDs."
                          accept=".pdf"
                          disabled={processandoDre === anoAtivo}
                          onFiles={(files) => handleDrePdf(anoAtivo, files)}
                        />
                        {processandoDre === anoAtivo && (
                          <p style={{ fontSize: 12.5, color: "var(--vgr-text-muted)", marginTop: 8 }}>Lendo o PDF…</p>
                        )}
                      </div>
                    )}

                    {dreExtraidoPorAno[anoAtivo] && (
                      <div className="vgr-card" style={{ marginTop: 12 }}>
                        <strong style={{ fontSize: 12.5, display: "block", marginBottom: 8 }}>
                          Confirme os valores extraídos do DRE de {anoAtivo}:
                        </strong>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div className="vgr-field-row"><span>Receita líquida</span><span>{moeda(dreExtraidoPorAno[anoAtivo]!.receitaLiquida)}</span></div>
                          <div className="vgr-field-row"><span>Despesas operacionais</span><span>{moeda(dreExtraidoPorAno[anoAtivo]!.despesasOperacionais)}</span></div>
                          <div className="vgr-field-row"><span>Resultado operacional</span><span>{moeda(dreExtraidoPorAno[anoAtivo]!.resultadoOperacional)}</span></div>
                          <div className="vgr-field-row"><span>Lucro líquido do exercício</span><span>{moeda(dreExtraidoPorAno[anoAtivo]!.lucroLiquidoExercicio)}</span></div>
                        </div>
                        {dreExtraidoPorAno[anoAtivo]!.avisos.map((a, i) => (
                          <Alert key={i} tone="warn" >⚠ {a}</Alert>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {!dados && (
                  <EmptyState
                    icon="☐"
                    title="Nenhuma análise disponível"
                    description="Importe os arquivos fiscais e contábeis para gerar o diagnóstico tributário."
                  />
                )}
                {dados && (
                  <div className="vgr-card">
                    <strong style={{ fontSize: 12.5, display: "block", marginBottom: 8 }}>Resumo</strong>
                    <div className="vgr-field-row"><span>Faturamento real base</span><span>{moeda(dados.faturamento)}</span></div>
                    {dados.periodoInicio && dados.periodoFim && (
                      <div className="vgr-field-row"><span>Período</span><span>{dados.periodoInicio} a {dados.periodoFim}</span></div>
                    )}
                  </div>
                )}
                {dados && (dados.faturamentoPorRegimeProduto.faturamentoZero > 0 || dados.faturamentoPorRegimeProduto.faturamentoReduzido60 > 0) && (
                  <Alert tone="info">
                    Regime especial por produto identificado pelo NCM: {moeda(dados.faturamentoPorRegimeProduto.faturamentoZero)} em
                    alíquota zero, {moeda(dados.faturamentoPorRegimeProduto.faturamentoReduzido60)} com redução de 60% — já entra
                    automaticamente na simulação.
                  </Alert>
                )}
                {dados?.conferenciaEfdEcd && (
                  <Alert tone={Math.abs(dados.conferenciaEfdEcd.diferencaPercentual) > 0.05 ? "danger" : "info"}>
                    Conferência EFD × ECD: {(dados.conferenciaEfdEcd.diferencaPercentual * 100).toFixed(0)}% de diferença entre
                    {" "}{moeda(dados.conferenciaEfdEcd.faturamentoEfd)} (EFD) e {moeda(dados.conferenciaEfdEcd.faturamentoEcd)} (ECD).
                    {Math.abs(dados.conferenciaEfdEcd.diferencaPercentual) > 0.05 && " Confira se falta algum mês de EFD."}
                  </Alert>
                )}
                {metodologia?.avisos.map((a, i) => (
                  <Alert key={i} tone="warn">⚠ {a}</Alert>
                ))}

                {dados && (
                  <div className="vgr-card">
                    <strong style={{ fontSize: 12.5, display: "block", marginBottom: 8 }}>Próximo passo</strong>
                    <Button
                      variant="secondary"
                      onClick={handleConsultarRegimes}
                      disabled={consultandoRegimes}
                      style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
                    >
                      {consultandoRegimes
                        ? `Consultando… ${progressoRegimes?.feitos ?? 0}/${progressoRegimes?.total ?? 0}`
                        : "Consultar fornecedores na Receita Federal"}
                    </Button>
                    <Button variant="primary" onClick={() => setFase("wizard")} style={{ width: "100%", justifyContent: "center" }}>
                      Continuar para a simulação →
                    </Button>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </Body>
        </>
      )}

      {fase === "wizard" && dadosEfetivos && (
        <>
          <TopBar crumb="Simulador" title="Simulação tributária" meta={<span>{empresaLabel} · {LABEL_PERFIL[perfil]}</span>} />
          <Body>
            <Button variant="tertiary" onClick={() => setFase("importar")} style={{ paddingLeft: 0, marginBottom: 12 }}>
              ← Importação
            </Button>
            <div className="vgr-phase-card">
              <SimuladorWizard
                modo={origemDados === "manual" ? "manual" : "sped"}
                nomeEmpresa={nomeEmpresa}
                setNomeEmpresa={setNomeEmpresa}
                perfil={perfil}
                setPerfil={setPerfil}
                regimeAtual={regimeAtual}
                setRegimeAtual={setRegimeAtual}
                isSimples={isSimples}
                anexoSimples={anexoSimples}
                setAnexoSimples={setAnexoSimples}
                tipoAviacao={tipoAviacao}
                setTipoAviacao={setTipoAviacao}
                tipoOperacaoConstrucao={tipoOperacaoConstrucao}
                setTipoOperacaoConstrucao={setTipoOperacaoConstrucao}
                percentualClienteContribuinte={percentualClienteContribuinte}
                setPercentualClienteContribuinte={setPercentualClienteContribuinte}
                percentualComprasProdutorRural={percentualComprasProdutorRural}
                percentualCreditoPresumidoProdutorRural={percentualCreditoPresumidoProdutorRural}
                setPercentualCreditoPresumidoProdutorRural={setPercentualCreditoPresumidoProdutorRural}
                meioPagamento={meioPagamento}
                setMeioPagamento={setMeioPagamento}
                modoProjecao={modoProjecao}
                setModoProjecao={setModoProjecao}
                margemAlvo={margemAlvo}
                setMargemAlvo={setMargemAlvo}
                avisoMeta={avisoMeta}
                taxaCrescimento={taxaCrescimento}
                setTaxaCrescimento={setTaxaCrescimento}
                metodologia={metodologia}
                faturamentoAnualManual={faturamentoAnualManual}
                onCustosChange={setCustosDespesasResultado}
                onSubmit={handleProcessarSimulacao}
              />
            </div>
          </Body>
        </>
      )}

      {fase === "processando" && (
        <>
          <TopBar crumb="Simulador" title="Simulação tributária" />
          <Body>
            <div className="vgr-phase-card">
              <ProcessingState
                title="Calculando cenário projetado…"
                description="Aplicando alíquotas de CBS/IBS por atividade e por produto, créditos e regras de transição."
              />
            </div>
          </Body>
        </>
      )}

      {fase === "resultado" && dadosEfetivos && panorama && resultadoSimulacao && (
        <>
          <TopBar
            crumb="Simulador / Resultado"
            title="Diagnóstico da simulação"
            meta={<span>{empresaLabel} · ano-base {resultadoSimulacao.anos[0].ano}</span>}
            actions={
              <Button variant="secondary" onClick={handleGerarApresentacao}>
                Gerar apresentação
              </Button>
            }
          />
          <Body>
            <Button variant="tertiary" onClick={() => setFase("wizard")} style={{ paddingLeft: 0, marginBottom: 4 }}>
              ← Ajustar simulação
            </Button>
            <ResultadoExecutivo dados={dadosEfetivos} resultadoSimulacao={resultadoSimulacao} panorama={panorama} />
          </Body>
        </>
      )}
    </>
  );
}
