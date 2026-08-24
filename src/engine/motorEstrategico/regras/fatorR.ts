/**
 * AVALIAR_FATOR_R — nasce de FATOR_R_ABAIXO_LIMITE (+ FS12_ADICIONAL_NECESSARIA
 * quando existir). NUNCA converte FS12 em pró-labore/folha automaticamente
 * (seção 16) — descreve apenas "avaliar composição válida da FS12"
 * (seção 17), sem prescrever contratação/salário/pró-labore.
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, pontoViradaPorVariavel, qualidadeMinima, type ContextoEstrategico } from "../contexto";

export function gerarAvaliarFatorR(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const fatorRAbaixo = achadosPorCodigo(ctx, "FATOR_R_ABAIXO_LIMITE")[0];
  if (!fatorRAbaixo) return [];

  const fs12Adicional = achadosPorCodigo(ctx, "FS12_ADICIONAL_NECESSARIA")[0];
  const pontoVirada = pontoViradaPorVariavel(ctx, "folha");
  const essenciais = [fatorRAbaixo, ...(fs12Adicional ? [fs12Adicional] : [])];

  return [
    {
      id: `alternativa:AVALIAR_FATOR_R:${ctx.ano}`,
      codigo: "AVALIAR_FATOR_R",
      categoria: "fator_r",
      titulo: "Avaliar Fator R",
      objetivo: "Avaliar composição válida da FS12 e os impactos correspondentes sobre o Anexo do Simples Nacional — sem prescrever contratação, salário ou pró-labore específico.",
      descricaoTecnica: `Fator R distante ${fatorRAbaixo.valor?.toFixed(2)} p.p. do limite de 28% em ${ctx.ano}.${fs12Adicional ? ` FS12 adicional necessária para atingir o limite: R$ ${fs12Adicional.valor?.toFixed(2)}.` : ""}`,
      achadosOrigem: essenciais.map((a) => a.id),
      evidencias: essenciais.flatMap((a) => a.evidencias),
      aplicabilidade: "potencialmente_aplicavel",
      condicoes: ["Atividade sujeita ao Fator R (LC 123/2006, art. 18, §5º-J).", "FS12/RBT12 computáveis a partir dos dados informados."],
      dependencias: ["confirmacao_de_premissa_de_folha_encargos_pro_labore"],
      restricoes: ["Este motor não decide COMO a FS12 seria composta — apenas que uma composição que atinja o limite existiria matematicamente."],
      impactosConhecidos: [
        { descricao: "Distância do Fator R ao limite de 28%", valor: fatorRAbaixo.valor, unidade: "pontos_percentuais", origem: "motor_achados:FATOR_R_ABAIXO_LIMITE" },
        ...(fs12Adicional ? [{ descricao: "FS12 adicional necessária para atingir o limite", valor: fs12Adicional.valor, unidade: "reais" as const, origem: "motor_achados:FS12_ADICIONAL_NECESSARIA" }] : []),
      ],
      impactosIndeterminados: ["custo trabalhista/previdenciário efetivo de qualquer composição de FS12", "efeito sobre outras obrigações societárias/contratuais"],
      cenariosRelacionados: [],
      pontosViradaRelacionados: pontoVirada?.valorEncontrado !== undefined ? [{ tipo: pontoVirada.tipo, variavel: pontoVirada.variavel, valorEncontrado: pontoVirada.valorEncontrado, estadoAntes: pontoVirada.estadoAntes?.estadoCategorico, estadoDepois: pontoVirada.estadoDepois?.estadoCategorico }] : [],
      periodosAplicaveis: [{ ano: ctx.ano }],
      qualidade: qualidadeMinima(essenciais),
      premissas: {},
      riscos: [{ tipo: "RISCO_TRIBUTARIO", descricao: "Mudança de anexo (III/V) altera a carga do DAS — efeito já calculado pelo motor fiscal, mas a composição de FS12 que a viabilizaria não foi definida aqui." }],
      bloqueios: [],
      validacoesNecessarias: [
        { tipo: "VALIDACAO_FISCAL", descricao: "Confirmar tratamento tributário de qualquer alteração na composição da FS12.", motivo: "Fator R depende de folha/encargos/pró-labore efetivamente recolhidos.", bloqueante: false },
        { tipo: "VALIDACAO_JURIDICA", descricao: "Avaliar impactos trabalhistas/previdenciários e, se aplicável, societários de qualquer composição considerada.", motivo: "Este motor não analisa legislação trabalhista/previdenciária/societária.", bloqueante: false },
      ],
      origens: fatorRAbaixo.origens,
    },
  ];
}
