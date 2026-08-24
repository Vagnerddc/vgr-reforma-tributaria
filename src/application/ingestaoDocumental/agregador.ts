/**
 * Agregador — reconcilia `ResultadoIngestaoDocumento[]` e preenche
 * diretamente um `RascunhoCenarioEmpresa` (nunca passa por
 * `DadosApuradosCliente`/`sped/agregador.ts`/adapter legado — ver
 * `__tests__/semAdapterLegadoIngestao.test.ts`). Não calcula tributo algum;
 * só reconcilia. Conflitos são PERSISTIDOS dentro de
 * `rascunho.ingestao.conflitos` (decisão do usuário) — reavaliação é
 * incremental: só os campos afetados pelos documentos desta rodada são
 * recalculados, o resto do estado de ingestão é copiado inalterado.
 */
import type { RascunhoCenarioEmpresa } from "../../features/wizardEstrategico/tipos";
import type { CampoComProveniencia, StatusInformacao } from "../../engine/operacaoTributaria";
import type { OperacaoTributariaNormalizada } from "../../engine/operacaoTributaria";
import type { AlertaIngestao, CampoExtraido, ConflitoFonte, MetadadoDocumentoProcessado, ResultadoIngestaoDocumento } from "./tipos";
import { normalizarParaCamposRascunho } from "./normalizador";
import { criarConflitoFonte, paraCampoComProveniencia, PREFERENCIA_POR_CAMPO } from "./proveniencia";

export interface ResultadoAgregacaoIngestao {
  rascunho: RascunhoCenarioEmpresa;
  alertasPeriodo: AlertaIngestao[];
  conflitosNovos: ConflitoFonte[];
}

const ORDEM_STATUS: StatusInformacao[] = ["estimado", "herdado", "importado", "confirmado"];
function melhorCandidato(candidatos: CampoExtraido<unknown>[]): CampoExtraido<unknown> {
  return candidatos.reduce((melhor, atual) => (ORDEM_STATUS.indexOf(atual.status) > ORDEM_STATUS.indexOf(melhor.status) ? atual : melhor));
}

export function obterValorAtual(rascunho: RascunhoCenarioEmpresa, chave: string): CampoComProveniencia<unknown> | undefined {
  if (chave === "identificacao.nomeEmpresa") return rascunho.identificacao.nomeEmpresa;
  if (chave === "identificacao.uf") return rascunho.identificacao.uf;
  if (chave === "identificacao.municipio") return rascunho.identificacao.municipio;
  if (chave === "receita.faturamentoAnual") return rascunho.receita.faturamentoAnual;
  if (chave === "pessoas.numeroEmpregados") return rascunho.pessoas.numeroEmpregados;
  if (chave === "pessoas.folhaAnual") return rascunho.pessoas.folhaAnual;
  if (chave === "pessoas.encargosAnual") return rascunho.pessoas.encargosAnual;
  if (chave === "pessoas.proLaboreAnual") return rascunho.pessoas.proLaboreAnual;
  if (chave.startsWith("tributario.premissas.")) return rascunho.tributario.premissas?.[chave.slice("tributario.premissas.".length)];
  return undefined;
}

/** Exportado para `wizardEstrategico/estado.ts` reaproveitar ao aplicar a resolução manual de um `ConflitoFonte` (mesmo mapeamento chave→campo, sem duplicar). */
export function aplicarValor(rascunho: RascunhoCenarioEmpresa, chave: string, valor: CampoComProveniencia<unknown>): void {
  if (chave === "identificacao.nomeEmpresa") { rascunho.identificacao.nomeEmpresa = valor as CampoComProveniencia<string>; return; }
  if (chave === "identificacao.uf") { rascunho.identificacao.uf = valor as CampoComProveniencia<string>; return; }
  if (chave === "identificacao.municipio") { rascunho.identificacao.municipio = valor as CampoComProveniencia<string>; return; }
  if (chave === "receita.faturamentoAnual") { rascunho.receita.faturamentoAnual = valor as CampoComProveniencia<number>; return; }
  if (chave === "pessoas.numeroEmpregados") { rascunho.pessoas.numeroEmpregados = valor as CampoComProveniencia<number>; return; }
  if (chave === "pessoas.folhaAnual") { rascunho.pessoas.folhaAnual = valor as CampoComProveniencia<number>; return; }
  if (chave === "pessoas.encargosAnual") { rascunho.pessoas.encargosAnual = valor as CampoComProveniencia<number>; return; }
  if (chave === "pessoas.proLaboreAnual") { rascunho.pessoas.proLaboreAnual = valor as CampoComProveniencia<number>; return; }
  if (chave.startsWith("tributario.premissas.")) {
    rascunho.tributario.premissas = rascunho.tributario.premissas ?? {};
    rascunho.tributario.premissas[chave.slice("tributario.premissas.".length)] = valor;
    return;
  }
}

function aplicarCnaes(rascunho: RascunhoCenarioEmpresa, candidatos: CampoExtraido<unknown>[]): void {
  const existentes = new Set((rascunho.identificacao.cnaes ?? []).map((c) => c.valor));
  const novos = candidatos.filter((c) => !existentes.has(c.valor as string));
  if (novos.length === 0) return;
  rascunho.identificacao.cnaes = [...(rascunho.identificacao.cnaes ?? []), ...novos.map((c) => paraCampoComProveniencia(c) as CampoComProveniencia<string>)];
}

function aplicarOperacoesXml(rascunho: RascunhoCenarioEmpresa, operacoes: OperacaoTributariaNormalizada[]): void {
  if (operacoes.length === 0) return;
  const existentes = new Map((rascunho.tributario.operacoes ?? []).map((op) => [op.id, op]));
  for (const op of operacoes) existentes.set(op.id, op);
  rascunho.tributario.operacoes = [...existentes.values()];
}

function ehManualmenteConfirmado(campo: CampoComProveniencia<unknown> | undefined): boolean {
  return campo !== undefined && campo.origem === "informado_usuario" && campo.status === "confirmado";
}

/**
 * Reconcilia UM grupo (mesma chave lógica + mesmo período) contra o valor
 * atual do rascunho e um eventual conflito já persistido. Retorna o valor a
 * aplicar (ou undefined para não tocar o campo) e o conflito resultante
 * (ou undefined se não há disputa).
 */
function reconciliarGrupo(params: {
  chave: string;
  periodo: string | undefined;
  candidatos: CampoExtraido<unknown>[];
  valorAtual: CampoComProveniencia<unknown> | undefined;
  conflitoExistente: ConflitoFonte | undefined;
}): { valorParaAplicar?: CampoComProveniencia<unknown>; conflito?: ConflitoFonte } {
  const { chave, periodo, candidatos, valorAtual, conflitoExistente } = params;
  const valoresDistintos = [...new Map(candidatos.map((c) => [JSON.stringify(c.valor), c])).values()];

  // Nada de novo em disputa entre os documentos desta chave.
  if (valoresDistintos.length <= 1) {
    const candidato = valoresDistintos[0];
    if (!candidato) return {};

    if (ehManualmenteConfirmado(valorAtual) && JSON.stringify(valorAtual!.valor) !== JSON.stringify(candidato.valor)) {
      // Documento concorda consigo mesmo mas diverge do valor já confirmado manualmente — nunca sobrescreve.
      const conflito = criarConflitoFonte({ campo: chave, periodo, valores: [candidato], gravidade: "atencao", status: "pendente", resolucao: { valorEscolhido: "informado_usuario", motivo: "valor já confirmado manualmente antes da importação deste documento" } });
      return { conflito };
    }

    if (conflitoExistente?.status === "resolvido_usuario") {
      const valorResolvido = conflitoExistente.resolucao?.valorEscolhido;
      const valorResolvidoBruto = valorResolvido === "informado_usuario" ? valorAtual?.valor : valorResolvido?.valor;
      if (JSON.stringify(valorResolvidoBruto) !== JSON.stringify(candidato.valor)) {
        const desatualizado: ConflitoFonte = {
          ...criarConflitoFonte({ campo: chave, periodo, valores: [candidato], gravidade: "atencao", status: "desatualizado" }),
          id: conflitoExistente.id,
          historico: [...(conflitoExistente.historico ?? []), { status: conflitoExistente.status, resolucao: conflitoExistente.resolucao }],
        };
        return { conflito: desatualizado };
      }
      return {}; // já resolvido e o documento confirma o mesmo valor — nada a fazer.
    }

    return { valorParaAplicar: paraCampoComProveniencia(candidato) };
  }

  // Documentos divergem entre si.
  const preferencia = PREFERENCIA_POR_CAMPO[chave];
  const escolhidoPorPreferencia = preferencia ? valoresDistintos.find((c) => c.tipoDocumento === preferencia) : undefined;

  if (ehManualmenteConfirmado(valorAtual)) {
    const conflito = criarConflitoFonte({ campo: chave, periodo, valores: valoresDistintos, gravidade: "atencao", status: "pendente", resolucao: { valorEscolhido: "informado_usuario", motivo: "valor já confirmado manualmente antes da importação destes documentos" } });
    return { conflito };
  }

  if (conflitoExistente?.status === "resolvido_usuario") {
    const valorResolvido = conflitoExistente.resolucao?.valorEscolhido;
    const valorResolvidoBruto = valorResolvido === "informado_usuario" ? valorAtual?.valor : valorResolvido?.valor;
    const aindaCondizente = valoresDistintos.every((c) => JSON.stringify(c.valor) === JSON.stringify(valorResolvidoBruto));
    if (!aindaCondizente) {
      const desatualizado: ConflitoFonte = {
        ...criarConflitoFonte({ campo: chave, periodo, valores: valoresDistintos, gravidade: "atencao", status: "desatualizado" }),
        id: conflitoExistente.id,
        historico: [...(conflitoExistente.historico ?? []), { status: conflitoExistente.status, resolucao: conflitoExistente.resolucao }],
      };
      return { conflito: desatualizado };
    }
    return {}; // já resolvido e todos os candidatos desta rodada confirmam o mesmo valor — nada a fazer.
  }

  if (escolhidoPorPreferencia) {
    const conflito = criarConflitoFonte({ campo: chave, periodo, valores: valoresDistintos, gravidade: "info", status: "resolvido_regra", resolucao: { valorEscolhido: escolhidoPorPreferencia, motivo: `preferência de fonte configurada para "${chave}": ${preferencia}` } });
    return { valorParaAplicar: paraCampoComProveniencia(escolhidoPorPreferencia), conflito };
  }

  const provisorio = melhorCandidato(valoresDistintos);
  const conflito = criarConflitoFonte({ campo: chave, periodo, valores: valoresDistintos, gravidade: "atencao", status: "pendente" });
  return { valorParaAplicar: paraCampoComProveniencia(provisorio), conflito };
}

export function agregarDocumentosParaRascunho(rascunhoBase: RascunhoCenarioEmpresa, resultados: ResultadoIngestaoDocumento[], operacoesXml: OperacaoTributariaNormalizada[] = []): ResultadoAgregacaoIngestao {
  const rascunho = structuredClone(rascunhoBase);
  rascunho.ingestao = rascunho.ingestao ?? { documentosProcessados: [], conflitos: [] };

  const novosDocumentos: MetadadoDocumentoProcessado[] = resultados.map((r) => ({
    documentoId: r.documentoId,
    tipoDocumento: r.tipoDocumento,
    nomeArquivo: r.metadados.nomeArquivo,
    periodo: r.periodo,
    status: r.status,
    processadoEm: r.metadados.processadoEm,
  }));
  const documentosPorId = new Map(rascunho.ingestao.documentosProcessados.map((d) => [d.documentoId, d]));
  for (const d of novosDocumentos) documentosPorId.set(d.documentoId, d);
  rascunho.ingestao.documentosProcessados = [...documentosPorId.values()];

  aplicarOperacoesXml(rascunho, operacoesXml);

  const grupos = normalizarParaCamposRascunho(resultados);
  const alertasPeriodo: AlertaIngestao[] = [];
  const conflitosNovos: ConflitoFonte[] = [];
  const conflitosPorId = new Map(rascunho.ingestao.conflitos.map((c) => [c.id, c]));

  for (const grupo of grupos) {
    if (grupo.chave === "identificacao.cnaes") {
      aplicarCnaes(rascunho, grupo.candidatos);
      continue;
    }

    const periodosDistintos = new Set(grupo.candidatos.map((c) => c.periodo).filter(Boolean));
    if (periodosDistintos.size > 1) {
      alertasPeriodo.push({ codigo: "periodo_divergente", mensagem: `Documentos com períodos diferentes (${[...periodosDistintos].join(", ")}) alimentariam o campo "${grupo.chave}" — processados separadamente, não agregados.`, gravidade: "atencao" });
    }

    const subgruposPorPeriodo = new Map<string, CampoExtraido<unknown>[]>();
    for (const candidato of grupo.candidatos) {
      const chavePeriodo = candidato.periodo ?? "";
      subgruposPorPeriodo.set(chavePeriodo, [...(subgruposPorPeriodo.get(chavePeriodo) ?? []), candidato]);
    }

    for (const [periodoChave, candidatos] of subgruposPorPeriodo) {
      const periodo = periodoChave || undefined;
      // Localiza por campo+período, não por id exato: o conjunto de fontes em disputa pode crescer entre
      // rodadas (um novo documento chega) sem que isso invalide a resolução anterior por conta própria — é
      // exatamente esse caso que deve virar "desatualizado" dentro de `reconciliarGrupo`, não desaparecer
      // silenciosamente por não casar o id antigo.
      const conflitoExistente = [...conflitosPorId.values()].find((c) => c.campo === grupo.chave && c.periodo === periodo);

      const { valorParaAplicar, conflito } = reconciliarGrupo({ chave: grupo.chave, periodo, candidatos, valorAtual: obterValorAtual(rascunho, grupo.chave), conflitoExistente });

      if (valorParaAplicar) aplicarValor(rascunho, grupo.chave, valorParaAplicar);
      if (conflito) {
        conflitosPorId.set(conflito.id, conflito);
        conflitosNovos.push(conflito);
      }
    }
  }

  // `conflitosPorId` já parte de TODOS os conflitos persistidos e só recebe `.set()` para as
  // chaves afetadas nesta rodada — conflitos de chaves não tocadas permanecem inalterados
  // (reavaliação incremental), sem precisar de filtro adicional aqui.
  rascunho.ingestao.conflitos = [...conflitosPorId.values()];

  return { rascunho, alertasPeriodo, conflitosNovos };
}
