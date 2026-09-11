# Phase 2I-C — Run Route Export / Print-to-PDF

Status: implementação concluída e verificações automatizadas passando; aceitação manual de impressão ainda pendente. Branch `phase-2i-c-route-export`. Sem commit/push.

## Arquivos

Modificados: `src/components/run-planner/RunPlanner.tsx`, `src/index.css`.

Criados:

- `src/utils/routeDocument.ts`: adaptador validado e modelo independente de React.
- `src/utils/routePrint.ts`: handler isolado de impressão/erro.
- `src/components/run-planner/export/RouteDocument.tsx`: documento, lista de ações, Digiline e roster somente de leitura.
- `src/components/run-planner/export/RunRouteExport.tsx`: portal, opções, impressão, foco e retorno.
- `tests/routeExport.test.cjs`: 50 regressões.
- `tests/helpers/loadTs.cjs`: carregador TypeScript para testes Node com grafo real.
- `tests/generateRouteFixtures.cjs`: geração determinística por ações reais, sem armazenamento de usuário.
- `tests/fixtures/route-fresh.json`, `route-short.json`, `route-mixed.json`, `route-long.json`.
- `tests/RouteExportPreview.tsx`, `tests/route-preview.html`, `tests/route-preview.config.ts`: build separada para QA, excluída do bundle normal.
- Este relatório.

## Arquitetura e fluxo

Escolhida exportação em estado local no RunPlanner, montada por portal direto no body. A interface original permanece montada, inerte durante a exportação. Isso preserva Battle/DNA/Trade e History ao retornar. Não há recarga, nova leitura de armazenamento nem troca de run.

Export Route fica dentro do resumo compacto. O clique valida a run com `isValidPersistedRunPlannerData`, que reutiliza a validação autoritativa existente, e cria um modelo de apresentação destacado do estado. Um erro bloqueia o documento. Back to Planner/Escape fecham a prévia; título, foco anterior e inert são restaurados. O foco de teclado fica nos controles do diálogo.

`buildRouteDocument(run, generatedAt)` é determinístico com data injetada. Não usa relógio implícito, IDs novos, writes, replay de progressão ou regras duplicadas. Eventos usam snapshots estáveis; participantes vêm do checkpoint do próprio evento. Encontros/domínios usam definições estáticas autoritativas. Nenhum lookup histórico usa o roster atual como fonte de identidade.

A data é formatada no locale/fuso do usuário e existe somente no documento. Título sugerido `DW2 Route - <nome>` sanitiza caracteres inseguros e controles; não promete controlar o nome final do PDF.

## Representação do documento

Cabeçalho: Digimon World 2, Speedrun Planner Route, nome da run, starter original (equipe/espécie), geração local, batalhas, total de ações, Bits atuais e contagem de roster. Não mostra UUID, instance IDs, versão de schema, chaves de storage ou checkpoints.

| Seção | Conteúdo |
| --- | --- |
| Battle | Action N, domínio/floor/fase, inimigos/EL, participantes históricos, recompensa gravada e captura exata com slot/EL ou None |
| Digivolution | From → To, EL, DP, HP +30, MP +30; nenhuma atribuição de aprendizagem de batalha a esse evento |
| DNA | Pais → resultado, rank/type reais, EL/DP/Max EL iniciais; Mutation e Matrix apenas quando houve mutação |
| Trade | Give → Receive históricos, EL, DP0 e Max EL recebidos; sem janela informativa de disponibilidade |
| Decisão de técnicas em Battle | Learned e Discarded do audit gravado. Offered/Kept completos não são armazenados, portanto não são fabricados |
| Decisão imediata DNA | Kept/Discarded do evento; não reproduz o pool interno |
| Final Digiline | Três slots ordenados, Empty, nome, EL/Max EL, DP e técnicas possuídas |
| Final roster | Nome, Active Digiline/Reserve, rank, DP, EL/cap, cinco stats exatos e técnicas atuais |
| Pending / milestone | Pending agrupado por EL; None quando vazio; próximo milestone e disponibilidade usam o helper existente |

A lista sempre percorre todo RunPlan.history, sem herdar filtro ou colapso do History. Numeração é a posição cronológica validada + 1. A run vazia mostra No route actions recorded yet. Cap não resolvido preserva intervalo e indicação de incerteza. Missed/discarded não são despejados no roster final.

Quatro opções simples, todas ligadas inicialmente: final roster, final Digiline, technique details, battle rewards. Nenhuma filtra ações.

## CSS, impressão e acessibilidade

Tokens claros locais ao documento: papel branco, texto quase preto, headings navy, bordas claras e acento dourado discreto. A tela principal mantém o tema Phase 2I-B. Prévia responsiva com max-width, padding fluido e quebra de palavras; nenhum canvas de largura A4 fixa.

`@media print` mostra somente o portal/documento; oculta controles, root/navegação e demais filhos do body; remove overlay fixo, overflow, sombra e fundo externo. `@page` usa size auto e margens 12 mm, permitindo A4/Letter pelo diálogo. Fonte do corpo 9 pt, título 20 pt, seções 14 pt, ações 10 pt. Blocos curtos usam break-inside/page-break-inside avoid; headings evitam quebra após si. Não há quebra forçada por evento.

HTML semântico com headings, listas e dl mantém texto selecionável e pesquisável. Tipos de evento/status são texto, não apenas cor. `window.print()` é chamado por handler isolado, com erro não destrutivo em caso de indisponibilidade/exceção. Nenhuma biblioteca PDF ou serviço externo foi adicionado. Cancelar o diálogo não grava dados.

## Verificação automatizada final

| Check | Resultado |
| --- | --- |
| Testes completos | **663/663** (613 anteriores + 50 exportação) |
| Data self-checks | **46/46**, também executados separadamente |
| TypeScript app | Passou |
| TypeScript node | Passou |
| Build produção | Passou |
| Lint | **7 erros / 7 avisos**, baseline preservado |
| git diff --check | Passou; apenas avisos de normalização LF/CRLF |
| Schema | v7, sem migração |
| Gameplay/persistência/validação | Nenhuma alteração de lógica |

Comandos: `node --test tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/theme.test.cjs tests/routeExport.test.cjs`; `node --test --test-name-pattern="all existing Phase 1.6a data self-checks still pass" tests/runPlanner.test.cjs`; `npx tsc -p tsconfig.app.json --noEmit`; `npx tsc -p tsconfig.node.json --noEmit`; `npm run build`; `npm run lint`; `git diff --check`.

Testes cobrem entrada ativa/inativa, abrir/fechar sem writes, modelo congelado, run inválida, dados/campos de todas as ações, numeração completa, invariância a filtros/colapso, summaries, IDs internos ausentes, opções, sanitização, handler de impressão e estruturas de print. Testes de classes não validam paginação física.

## Bundle antes/depois

Comparação com o log final da Phase 2I-B, mesma toolchain:

| Asset | Antes | Depois | Variação |
| --- | --- | --- | --- |
| JS minificado | 916,34 kB | 925,57 kB | +9,23 kB |
| JS gzip | 215,36 kB | 216,40 kB | +1,04 kB |
| CSS | 66,24 kB | 68,59 kB | +2,35 kB |
| CSS gzip | 11,94 kB | 12,55 kB | +0,61 kB |

Fixtures de 220 ações existem somente no build separado de QA, nunca na entrada de produção normal. Permanecem os avisos históricos de tamanho do bundle e Browserslist antigo.

## QA visual realizada e pendências

Build de produção da galeria executada com `npm run build -- --config tests/route-preview.config.ts`, em `dist-ssr/route-qa`. Servida por `npm run preview -- --host 127.0.0.1 --port 4191 --outDir dist-ssr/route-qa`.

Foi inspecionada visualmente a prévia da rota mista no navegador integrado em 1280x720: folha clara centralizada, controles navy separados, títulos/metadados legíveis e ações compactas. A captura foi exibida na conversa. O DOM confirmou as 19 ações, 15 batalhas, 63340 Bits, starter original e opções ligadas. Print / Save as PDF foi acionado; o navegador integrado não expôs a janela de impressão na leitura da página.

Tentou-se continuar pelo Chrome nativo em uma janela separada. A automação foi interrompida pelo controle de segurança porque não conseguiu determinar a URL atual com confiança suficiente. Nenhum bypass foi tentado. Essa interrupção impede afirmar que a QA manual obrigatória está concluída.

**Ainda não verificado:** impressão da run vazia; A4 e Letter para as rotas curta/mista/longa; paginação real e ausência de clipping nas páginas; mobile; persistência visual das seleções após retorno na aplicação real. Não existem capturas de A4, multipágina ou mobile nesta entrega. Os cenários e controles de QA estão prontos para executar quando a automação puder prosseguir.

As fixtures têm 0, 3, 19 e 220 ações, todas validadas pelo motor real. A mista inclui captura/sem captura, Trade, evolução normal, descarte de Nova Blast, DNA normal, mutação Vademon, Digiline, Reserve e técnicas pendentes. As cenas não usam localStorage.

## Compatibilidade futura e conclusão de escopo

Um futuro `@react-pdf/renderer` pode consumir o mesmo RouteDocumentModel com pouca duplicação de apresentação. O modelo não contém React, callbacks, IDs/checkpoints ou dependência do DOM; apenas o renderer/layout precisaria ser específico. Nenhuma implementação PDF direta foi adicionada nesta fase.

Exportar nunca modifica RunPlan, updatedAt, roster, Digiline ou history. Código concluído e testes passando, mas a fase permanece aguardando a QA manual listada acima para aceitação completa. Nenhum commit ou push realizado.
