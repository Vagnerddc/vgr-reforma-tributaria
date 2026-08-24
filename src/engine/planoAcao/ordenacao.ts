/**
 * Ordenação topológica determinística (seção 36) — nunca prioridade
 * estratégica (seção 39): ações no mesmo nível são paralelas porque
 * nenhuma depende da outra, nunca porque receberam um "score" maior.
 * Ciclo produz erro estruturado (seção 35), nunca um plano parcial
 * silenciosamente incompleto.
 */

import { CicloDependenciaError, type AcaoEstruturada, type EtapaPlano } from "./tipos";

export function ordenarTopologicamente(acoes: AcaoEstruturada[]): EtapaPlano[] {
  const grauEntrada = new Map(acoes.map((a) => [a.id, a.dependeDe.length]));
  const dependentes = new Map<string, string[]>();
  for (const a of acoes) for (const dep of a.dependeDe) dependentes.set(dep, [...(dependentes.get(dep) ?? []), a.id]);

  const etapas: EtapaPlano[] = [];
  let processados = 0;
  let nivelAtual = [...acoes.filter((a) => grauEntrada.get(a.id) === 0)].map((a) => a.id).sort();

  let numero = 1;
  while (nivelAtual.length > 0) {
    etapas.push({ numero, acoes: nivelAtual });
    processados += nivelAtual.length;
    const proximoNivel = new Set<string>();
    for (const id of nivelAtual) {
      for (const dependenteId of dependentes.get(id) ?? []) {
        const grau = (grauEntrada.get(dependenteId) ?? 0) - 1;
        grauEntrada.set(dependenteId, grau);
        if (grau === 0) proximoNivel.add(dependenteId);
      }
    }
    nivelAtual = [...proximoNivel].sort();
    numero++;
  }

  if (processados < acoes.length) {
    const nosCiclo = acoes.filter((a) => (grauEntrada.get(a.id) ?? 0) > 0).map((a) => a.id);
    throw new CicloDependenciaError(nosCiclo);
  }

  return etapas;
}
