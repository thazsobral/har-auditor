# har-auditor `[BETA]`

> **Toolbox Client-Side de Alta Performance para Análise, Investigação Forense, Sanitização LGPD e Auditoria de Arquivos HTTP Archive (.HAR).**

![har-auditor Beta](https://img.shields.io/badge/version-v0.9.4--beta-cyan.svg)
![Client-Side](https://img.shields.io/badge/privacy-100%25_client--side-emerald.svg)
![OWASP](https://img.shields.io/badge/security-OWASP_&_CWE_heuristics-rose.svg)
![Worker](https://img.shields.io/badge/parser-Web_Worker_Streams-blue.svg)
![License](https://img.shields.io/badge/copyright-©_2026_har--auditor-zinc.svg)

---

## 📌 Visão Geral

O **har-auditor** é uma suíte forense de auditoria e diagnóstico de tráfego de rede criada para desenvolvedores, equipes de segurança (SecOps/AppSec) e engenheiros de qualidade. 

A ferramenta opera **100% client-side**: nenhum arquivo, payload, cabeçalho de autorização ou token trafega para servidores externos. O processamento é realizado no navegador através de **Web Workers** com leitura por **Streams**, garantindo altíssima velocidade e estabilidade mesmo em arquivos `.HAR` volumosos (> 100MB).

---

## 🚀 Módulos e Ferramentas

O **har-auditor** adota uma **Arquitetura Modular de Plugins** através do `ToolRegistry`, disponibilizando ferramentas especializadas:

### 1. 🛡️ Sanitizador & Privacidade (LGPD / GDPR)
- **Remoção de Segredos**: Higienização automática de tokens de autenticação (`Authorization: Bearer`, cookies de sessão, `Set-Cookie`, `x-api-key`, etc.).
- **Mascaramento de Dados Sensíveis**: Detecção e substituição de CPFs, cartões e e-mails no corpo das requisições e respostas.
- **Comparativo Visual Lado a Lado**: Visualização em tempo real de como o tráfego era antes e como ficará após a sanitização.
- **Exportação Segura**: Download instantâneo do arquivo `.HAR` higienizado para compartilhamento seguro em tickets ou fóruns públicos.

### 2. 🚨 Auditoria de Segurança Forense
- **Vazamento de Credenciais em URLs (CWE-598)**: Identificação de JWTs, tokens de API e senhas transmitidos indevidamente em query parameters.
- **Transmissão em Texto Claro (CWE-319)**: Alertas para endpoints chamados via HTTP puro sem criptografia TLS.
- **Cabeçalhos de Segurança Ausentes**: Checagem de conformidade para `Content-Security-Policy (CSP)`, `Strict-Transport-Security (HSTS)`, `X-Content-Type-Options` e `X-Frame-Options`.
- **Auditoria de Cookies**: Diagnóstico de cookies sensíveis sem as flags `Secure`, `HttpOnly` ou com políticas fracas de `SameSite`.
- **CORS Malconfigurado**: Alerta de uso de `Access-Control-Allow-Origin: *` em requisições contendo credenciais.

### 3. 🔑 JWT Decoder & Inspetor Forense
- **Detecção Automática**: Localização instantânea de tokens JWT em headers de autorização e query params.
- **Decodificação Client-Side**: Leitura e formatação de cabeçalho (algoritmo, tipagem) e payload com claims (`sub`, `iss`, `aud`, `roles`).
- **Validação Temporal**: Alertas visuais de status para tokens expirados (`exp`), tempo restante de validade e data de emissão (`iat`).

### 4. ⚡ Anomalias de Rede (N+1 & Race Conditions)
- **Detecção de N+1 Queries no Frontend**: Identificação de rajadas de requisições idênticas disparadas em janelas inferiores a 500ms.
- **Race Conditions e Inversão de Resposta**: Rastreamento de chamadas concorrentes onde a resposta mais tardia chegou fora de ordem em relação ao envio, podendo sobrescrever o estado da aplicação no frontend.

### 5. 🔀 HAR Diff (Comparador de Execuções e Regressões)
- **Comparação Lado a Lado**: Carregamento de um segundo arquivo HAR (Baseline anterior vs. Atual).
- **Detecção de Rotas Faltantes e Novas**: Mapeamento diferencial de endpoints presentes apenas na versão A ou na versão B.
- **Diagnóstico de Variações**: Comparação visual de deltas de tempo (ms), volume transferido (bytes), mudanças de códigos de status HTTP e diferenças de payload.

### 6. 📦 Exportador de Mocks para Testes Automatizados
- **Mock Service Worker (MSW)**: Geração de handlers REST prontos para execução em testes unitários e de integração.
- **Cypress (`cy.intercept`)**: Código pronto para fixture de testes E2E.
- **Playwright (`page.route`)**: Rotas mockadas com status e cabeçalhos preservados.
- **Postman Collection v2.1**: Exportação JSON compatível com Postman e Insomnia para reprodução imediata.

### 7. ⏱️ Waterfall de Timings e Telemetria de Domínios
- Decomposição detalhada dos estágios de latência (DNS, Conexão TCP, TLS Handshake, TTFB e Download).
- Identificação de domínios primários (1st party) versus rastreadores de telemetria e scripts de terceiros (3rd party).

---

## 🛠️ Tecnologias Utilizadas

- **React 19 & TypeScript**: Código tipado de ponta a ponta e componentes funcionais modulares.
- **Tailwind CSS v4**: Design system responsivo com suporte completo a **Dark Mode**, **Light Mode** e **System Preference**.
- **Zustand**: Gerenciamento de estado global reativo e de alta performance.
- **Web Worker com Streaming**: Processamento assíncrono isolado fora da thread principal de renderização.
- **Lucide Icons**: Conjunto semântico de ícones para auditoria e status.

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
- Node.js (v18 ou superior)
- npm ou yarn

### Instalação e Execução

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor de desenvolvimento Vite
npm run dev

# 3. Compilar para produção
npm run build

# 4. Executar verificação de tipos e linter
npm run lint
```

O aplicativo estará disponível em `http://localhost:3000`.

---

## 🔒 Compromisso de Privacidade e Segurança

1. **Zero Telemetria Externa**: O **har-auditor** não faz requisições externas para coleta de dados de navegação ou métricas do usuário.
2. **Processamento em Memória Local**: Todos os arquivos carregados são processados exclusivamente na memória RAM da sessão do navegador.
3. **Ambiente Isolado**: Ao fechar ou recarregar a aba, os arquivos em memória são liberados automaticamente.

---

## 📄 Licença e Propriedade

**har-auditor • Todos os direitos reservados © 2026**
