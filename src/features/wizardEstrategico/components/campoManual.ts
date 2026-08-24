import { campoComProveniencia } from "../../../engine/operacaoTributaria";

/** Toda entrada manual do Wizard V2 nasce como informado_usuario/confirmado — editar um campo importado deve registrar essa origem (seção 68), nunca preservar "importado" silenciosamente. */
export function campoManual<T>(valor: T) {
  return campoComProveniencia(valor, "informado_usuario", "confirmado");
}

export function campoManualOuIndefinido<T>(valor: T | undefined): ReturnType<typeof campoManual<T>> | undefined {
  return valor === undefined ? undefined : campoManual(valor);
}
