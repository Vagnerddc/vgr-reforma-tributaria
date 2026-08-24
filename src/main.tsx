import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Tokens e componentes do Design System carregados globalmente — usados por
// toda tela interna e também por /simulador (que fica fora do AppShell, mas
// não fora do Design System).
import './design-system/tokens.css'
import './design-system/components.css'
import { aplicarTema, lerTemaSalvo } from './design-system/tema'
import App from './App.tsx'

// Aplica o tema salvo ANTES do primeiro render — precisa rodar aqui (não só
// quando a tela de Configurações monta), senão a preferência não é respeitada
// ao recarregar a página ou abrir direto qualquer outra rota.
aplicarTema(lerTemaSalvo())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
