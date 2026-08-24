import { avaliarCompletudeOperacao, type OperacaoTributariaNormalizada, type ResultadoCalculoNormalizado } from "../operacaoTributaria";

/**
 * OfficialEngineAdapter — única peça do sistema que conhece o formato HTTP
 * real do Motor Oficial (confirmado no spike: POST
 * http://localhost:8080/api/calculadora/regime-geral). Isolado por design
 * (docs/arquitetura-motor-hibrido.md §11): converte
 * OperacaoTributariaNormalizada → contrato oficial, chama o componente,
 * converte a resposta → ResultadoCalculoNormalizado preservando memória de
 * cálculo e fundamento legal, carimba versão/origem, e nunca fabrica um
 * resultado com aparência oficial quando a chamada falha.
 *
 * Ainda EXPERIMENTAL — não conectado a Dashboard/Simulador/Resultado. O
 * componente oficial continua rodando localmente (Docker), fora do
 * fluxo produtivo, sob o gate jurídico de licenciamento (ver
 * docs/arquitetura-motor-hibrido.md §14 — distribuição/embutimento
 * permanecem bloqueados).
 */

export interface OfficialEngineConfig {
  baseUrl: string;
  /** Versão do pacote/imagem do Motor Oficial — o adapter carimba isso porque a resposta HTTP não se autoidentifica (achado do spike). */
  versaoMotor: string;
  /** Injeção de fetch para permitir testes sem rede real — nunca aponta para fora de baseUrl (processamento sempre local). */
  fetchImpl?: typeof fetch;
}

export type ResultadoAdapter =
  | { ok: true; resultado: ResultadoCalculoNormalizado }
  | { ok: false; erro: { tipo: "dados_insuficientes" | "erro_http" | "erro_rede"; detalhe: string; camposFaltantes?: string[] } };

interface ItemContratoOficial {
  numero: number;
  ncm: string;
  quantidade: number;
  unidade: string;
  cst: string;
  baseCalculo: number;
  cClassTrib: string;
}

interface RequestContratoOficial {
  id: string;
  versao: string;
  dataHoraEmissao: string;
  municipio: number;
  uf: string;
  itens: ItemContratoOficial[];
}

/** Converte VGR → contrato oficial. Só chamado depois de confirmar completude normativa — nunca envia campo ausente como inventado. */
function paraContratoOficial(op: OperacaoTributariaNormalizada): RequestContratoOficial {
  return {
    id: op.id,
    versao: "1.0.0",
    dataHoraEmissao: op.identificacao.data?.valor ?? new Date().toISOString(),
    municipio: Number(op.localidade.municipio!.valor),
    uf: op.localidade.uf!.valor,
    itens: [
      {
        numero: 1,
        ncm: op.produtoServico.ncm!.valor,
        quantidade: op.produtoServico.quantidade!.valor,
        unidade: op.produtoServico.unidade!.valor,
        cst: op.classificacaoTributaria.cst!.valor,
        baseCalculo: op.valores.baseCalculo?.valor ?? op.valores.valorOperacao!.valor,
        cClassTrib: op.classificacaoTributaria.cClassTrib!.valor,
      },
    ],
  };
}

// Duas formas de citação observadas em respostas reais do Motor Oficial:
// "Art. 412, I" (remissão a artigo) e "LC 214/2025" (remissão à própria lei complementar,
// sem artigo específico — comum quando o enquadramento é "tributação integral", sem redução).
const REGEX_FUNDAMENTO = /Art\.\s*\d+[^,.]*|LC\s*\d+\/\d+/g;

/**
 * Converte resposta oficial → ResultadoCalculoNormalizado, preservando a
 * memória de cálculo/fundamento legal integralmente (seção 15 do pedido) —
 * nunca reduz a resposta a só os números finais.
 */
function paraResultadoNormalizado(operacaoId: string, respostaOficial: any, versaoMotor: string): ResultadoCalculoNormalizado {
  const objeto = respostaOficial.objetos?.[0]?.tribCalc ?? {};
  const ibscbs = objeto.IBSCBS;
  const is = objeto.IS;
  const gIBSCBS = ibscbs?.gIBSCBS;

  const vIBS = parseFloat(gIBSCBS?.vIBS ?? "0");
  const vCBS = parseFloat(gIBSCBS?.gCBS?.vCBS ?? "0");
  const vIS = parseFloat(is?.vIS ?? "0");
  const baseCalculo = parseFloat(gIBSCBS?.vBC ?? is?.vBCIS ?? "0");
  const pIBSUF = parseFloat(gIBSCBS?.gIBSUF?.pIBSUF ?? "0");
  const pIBSMun = parseFloat(gIBSCBS?.gIBSMun?.pIBSMun ?? "0");
  const pCBS = parseFloat(gIBSCBS?.gCBS?.pCBS ?? "0");

  const narrativas: string[] = [
    is?.memoriaCalculo,
    gIBSCBS?.gIBSUF?.memoriaCalculo,
    gIBSCBS?.gIBSMun?.memoriaCalculo,
    gIBSCBS?.gCBS?.memoriaCalculo,
  ].filter((n): n is string => typeof n === "string" && n.length > 0);

  const fundamentos = new Set<string>();
  for (const n of narrativas) for (const m of n.match(REGEX_FUNDAMENTO) ?? []) fundamentos.add(m.trim());

  const cargaTributaria = baseCalculo > 0 ? ((vIBS + vCBS + vIS) / baseCalculo) * 100 : 0;

  return {
    operacaoId,
    valores: {
      cbs: vCBS,
      ibs: vIBS,
      is: vIS,
      baseCalculo,
      aliquotaEfetiva: pIBSUF + pIBSMun + pCBS,
      cargaTributaria,
    },
    memoriaCalculo: {
      narrativa: narrativas.join(" "),
      fundamentoLegal: [...fundamentos].join("; ") || undefined,
    },
    proveniencia: {
      origemCalculo: "motor_oficial",
      versaoMotor,
      executadoEm: new Date().toISOString(),
      qualidade: "confirmado",
    },
  };
}

export class OfficialEngineAdapter {
  private readonly config: OfficialEngineConfig;

  constructor(config: OfficialEngineConfig) {
    this.config = config;
  }

  /**
   * Calcula UMA operação — nunca chama o componente oficial se a operação
   * não estiver normativamente completa (avaliarCompletudeOperacao); nesse
   * caso devolve erro "dados_insuficientes" sem fazer a requisição.
   */
  async calcularOperacao(op: OperacaoTributariaNormalizada): Promise<ResultadoAdapter> {
    const completude = avaliarCompletudeOperacao(op);
    if (completude.completudeEntrada !== "completa") {
      return { ok: false, erro: { tipo: "dados_insuficientes", detalhe: "Operação não tem os campos mínimos exigidos pelo Motor Oficial.", camposFaltantes: completude.camposFaltantes } };
    }

    const request = paraContratoOficial(op);
    const fetchFn = this.config.fetchImpl ?? fetch;

    let resposta: Response;
    try {
      resposta = await fetchFn(`${this.config.baseUrl}/api/calculadora/regime-geral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    } catch (e) {
      return { ok: false, erro: { tipo: "erro_rede", detalhe: e instanceof Error ? e.message : "erro de rede desconhecido ao chamar o Motor Oficial" } };
    }

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      let detalhe = `HTTP ${resposta.status}`;
      try {
        const problema = JSON.parse(corpo);
        detalhe = problema.detail ?? problema.title ?? detalhe;
      } catch {
        // corpo não era RFC 7807 — mantém o status como detalhe, nunca finge sucesso
      }
      return { ok: false, erro: { tipo: "erro_http", detalhe } };
    }

    const json = await resposta.json();
    return { ok: true, resultado: paraResultadoNormalizado(op.id, json, this.config.versaoMotor) };
  }
}
