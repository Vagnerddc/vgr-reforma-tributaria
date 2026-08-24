/**
 * Mesmo algoritmo de `engine/iaConsultiva/contexto.ts::hashContexto`
 * (rolling hash não-criptográfico sobre JSON.stringify), generalizado
 * para qualquer objeto serializável — `hashContexto` é tipado
 * estritamente a `ContextoIaConsultiva`, por isso não é reutilizável
 * diretamente aqui.
 */
export function hashObjeto(valor: unknown): string {
  const texto = JSON.stringify(valor);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  }
  return `mem-${(hash >>> 0).toString(16)}`;
}
