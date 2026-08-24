# Importação de dados do cliente (EFDs, ECD, ECF)

Disponível em `/importar` (link no topo do simulador interno). Processa
arquivos SPED **inteiramente no navegador** — nenhum arquivo é enviado a
servidor, dado o caráter sensível dos dados fiscais do cliente.

Aceita os `.txt` soltos ou um **`.zip`** contendo vários deles (extraído em
memória via `fflate`, sem enviar nada a servidor) — útil quando o cliente
manda tudo compactado num arquivo só. Dentro do zip, pastas, `__MACOSX`, e
extensões não-SPED (`.xml`, `.pdf`, imagens, planilhas) são ignoradas
automaticamente.

## O que é extraído, por arquivo

| Arquivo | Registros usados | O que extrai |
|---|---|---|
| EFD ICMS/IPI | 0000, 0150, C100/C170, E110 | Participantes (CNPJ/CPF), movimento de mercadorias por CFOP (faturamento, custo/insumo, imobilizado, uso e consumo), ICMS a recolher |
| EFD Contribuições | 0000, 0150, A100, C100/C170, M200, M600 | Participantes, serviços tomados/prestados, movimento de mercadorias, PIS e Cofins a recolher |
| ECD | 0000, I050, I155 | Plano de contas e saldos periódicos — usado para uma classificação de despesas (operacional/administrativa/custo) mais completa que a das EFDs |
| ECF | — | **Não implementado nesta versão** — ver limitações |

## Como a natureza do lançamento é decidida

- **Com EFDs**: pelo **CFOP** do item (`src/engine/sped/efdIcmsIpi.ts`,
  função `classificarPorCfopIcms`) — cobre os grupos mais comuns de compra
  para revenda/insumo, imobilizado e uso e consumo. CFOPs fora dessa lista
  caem em "outros" (nunca são descartados do total, só não aparecem
  detalhados por natureza).
- **Com ECD**: por **palavra-chave no nome da conta contábil**
  (`src/engine/sped/ecd.ts`, função `classificarPorDescricaoConta`) — é uma
  heurística, não uma leitura do plano de contas referencial oficial (que
  varia por empresa). Sempre visível na tela para o contador confirmar.
- **Quando há ECD**, ela substitui inteiramente a classificação de despesas
  das EFDs (não soma as duas, para não contar a mesma despesa duas vezes) —
  a ECD é a fonte contábil mais completa (inclui folha, aluguel sem nota,
  etc., que as EFDs não capturam).

## Regime dos parceiros (quem gera crédito de CBS/IBS)

O SPED não informa se um parceiro é optante do Simples Nacional — isso é
consultado à Receita Federal via `/api/cnpj` (mesma função usada no
simulador público), CNPJ por CNPJ, com um pequeno intervalo entre chamadas
para não estourar o limite de requisições da BrasilAPI. Participantes com
CPF (sem CNPJ) são marcados como pessoa física automaticamente, sem
necessidade de consulta.

**Presunção assumida**: um parceiro optante do Simples é tratado como
Simples **unificado** (não gera crédito integral) — o SPED não permite saber
se ele migrou para o híbrido. Se o contador souber que um fornecedor
específico optou pelo híbrido, deve desconsiderar o alerta de crédito
restrito para aquele parceiro.

## Projeção 2027

O faturamento e a carga apurados (ano-base dos arquivos importados) são
multiplicados por uma taxa de crescimento anual (`src/engine/projecao.ts`)
para estimar 2027 — com uma sugestão de taxa por setor em
`config/atividades.json` (`taxaCrescimentoDefaultPorPerfil`), sempre editável.
O faturamento projetado é então usado como constante nos demais anos da
simulação (2026-2033) — a mesma simplificação que todo o motor já usa
(nenhum ano do simulador modela crescimento composto ano a ano).

## Limitações conhecidas (deliberadas, não esquecidas)

1. **ECF não extrai valores** (`src/engine/sped/ecf.ts`). O leiaute do
   registro 0000 da ECF difere do usado por EFD/ECD, e os registros de
   receita bruta/lucro (Bloco M/Y) exigem validação pontual do leiaute
   oficial antes de extrair automaticamente — preferiu-se não arriscar
   apurar um número errado silenciosamente. Use o faturamento das EFDs.
2. **Classificação de despesa por CFOP e por palavra-chave são heurísticas**,
   não uma apuração fiscal formal. Sempre exibidas para o contador revisar.
3. **CFOPs fora da lista coberta** caem em "outros" — não aparecem
   detalhados por natureza, mas entram no aviso do arquivo processado.
4. **Regime do parceiro Simples** presumido como unificado (ver acima).
5. **Projeção 2027 usa faturamento constante** nos demais anos da simulação
   — não modela crescimento composto ano a ano até 2033.

Ao encontrar um caso real onde alguma dessas limitações distorce o resultado
de forma relevante, o caminho é refinar o extrator específico (adicionando
mais CFOPs, ou implementando a extração da ECF com o leiaute oficial
validado) — não contornar na interface.
