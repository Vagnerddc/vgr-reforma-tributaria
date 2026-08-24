/**
 * Isolamento de provedor (seção 5/6 do pedido) — nenhum motor
 * determinístico importa isto. Só `motor.ts` (deste módulo) referencia
 * um `ProvedorIaConsultiva`.
 */

import type { ProvedorIaConsultiva, RequisicaoIaConsultiva, RespostaBrutaIa } from "./tipos";
import { gerarRespostaFallback } from "./templatesFallback";

/**
 * Provedor padrão quando nenhum outro está configurado — a plataforma
 * nunca depende de um provedor externo para funcionar (seção 52/54).
 * Implementa `ProvedorIaConsultiva` só para uniformidade de interface;
 * `motor.ts` trata este caso como "sem provedor" antes mesmo de chamar
 * `gerar`, mas mantê-lo aqui documenta a garantia de continuidade.
 */
export const provedorNulo: ProvedorIaConsultiva = {
  nome: "nenhum",
  async gerar(request: RequisicaoIaConsultiva): Promise<RespostaBrutaIa> {
    return gerarRespostaFallback(request.contexto, request.nivel);
  },
};
