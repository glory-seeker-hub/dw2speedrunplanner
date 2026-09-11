# Phase 2J-A — validação

Branch: `phase-2j-a-rank-gated-technique-learning`. Sem commit ou push.

1. **Causa:** `advanceTechniqueState` considerava apenas o nível efetivo pendente, permitindo concluir marcos acima do rank atual.
2. **Arquitetura:** `learningMilestones.ts` deriva o requisito e a ordem de ranks da tabela canônica `TECHNIQUE_UNLOCK_LEVELS`. `battleTechniqueProgression.ts` compartilha XP/cap e transição entre gravação, prévia de escolhas, avisos e auditoria histórica. React apenas apresenta o resultado.
3. **EL12:** exige Champion ou superior; Rookie perde todos os potenciais pendentes desse evento.
4. **EL22:** exige Ultimate ou Mega; Champion ou inferior perde esse evento.
5. **EL32:** exige Mega; ranks inferiores perdem esse evento. EL2 aceita Rookie ou superior.
6. **DNA direto:** filhos Champion EL11 e Ultimate EL21 preservam a técnica própria disponível no nascimento e aprendem lotes herdados de ranks inferiores no marco seguinte. O requisito é do evento, não do rank intrínseco de cada técnica.
7. **Mutações:** Vademon usa Ultimate; Yanmamon e SandYanmamon usam Champion. Regressões preservadas.
8. **Estado:** somente entradas `pending` no nível efetivo do evento viram `{status:'missed',level}`. Não entram em `techs`, não permanecem pendentes e não recuperam automaticamente após evolução tardia. Técnicas já possuídas são mantidas. A validação estrutural aceita perdas de técnicas herdadas em marcos posteriores ao rank intrínseco; a validação cronológica continua verificando o histórico exato.
9. **Aviso:** informativo e não bloqueante, aparece apenas quando XP e cap realmente permitem cruzar um marco com rank insuficiente. Reservas, XP insuficiente, cap e rank suficiente não produzem falso aviso. Não abre seleção quando só há perdas.
10. **Próxima técnica própria:** derivada do alvo único da evolução normal no DP atual, sem inserir o potencial de uma forma futura no pool atual. Identidades canônicas são deduplicadas.
11. **Participantes:** cada participante afetado recebe seu próprio aviso e sua própria lista de técnicas.
12. **Histórico:** `techniqueMisses` registra perdas efetivas por instância, separadamente de aprendidas/descartadas. History e Export usam o audit persistido e o nome no checkpoint, sem inferir perdas a partir do roster final.
13. **Schema:** permanece v7. O campo aditivo é omitido quando não há perdas. Sua ausência só é aceita se o checkpoint não exigir perdas; conteúdo presente é validado contra o cálculo autoritativo. Saves antigos que dependiam do aprendizado incorreto podem ser rejeitados. Migração de saves de desenvolvimento não foi adicionada, conforme escopo.
14. **Undo:** restaura exatamente roster, nível, XP, stats e potenciais pendentes. A repetição da mesma batalha reproduz estado e audit de perdas.
15. **Estado obsoleto:** callback revisado antes de uma evolução é rejeitado; um callback atualizado recalcula a batalha e solicita a seleção válida.
16. **Exportação longa:** a fixture encontrada nesta branch não continha o SnowAgumon/Action 79 citado. O gerador normal agora cria a linhagem real Greymon + Frigimon → SnowAgumon, perde Nova Blast/SubzeroIcePunch na Action 33 e termina com SnowAgumon Rookie EL14 sem ambas. Mantém 220 ações válidas. Uma fixture alternativa evolui para Frigimon antes do marco e aprende ambas. JSON não foi editado manualmente.
17. **Testes:** 708/708 passaram, zero falhas ou skips: 663 existentes e 45 regressões novas. Inclui Run Planner, hardening, tema, exportação, captura durante perda, History, auditoria adulterada, persistência e stale callback. Preparações antigas que aprendiam acima do rank foram ajustadas para evoluções válidas; o teste de overflow continua exercitando mais de 12 opções, quota e atomicidade.
18. **Data self-checks:** 46/46 passaram, também executados separadamente.
19. **TypeScript/build:** ambos `tsc --noEmit -p tsconfig.app.json` e `tsconfig.node.json` passaram. `npm run build` passou; avisos de Browserslist desatualizado e chunk acima de 500 kB permanecem.
20. **Lint:** `npm run lint` mantém exatamente 7 erros / 7 warnings históricos, todos em arquivos não alterados nesta fase. Nenhum novo achado.
21. **Diff:** `git diff --check` passou.

## QA no navegador

Em `/tests/rank-learning-preview.html`, usando componentes e gravação reais com fixture somente em memória:

- SnowAgumon EL11: Hail Storm possuída; Nova Blast/SubzeroIcePunch pendentes; aviso visível e Record Battle habilitado.
- Record Battle: EL12 Rookie, somente Hail Storm possuída, ambas `missed`; nenhum seletor; XP/stats/Bits aplicados e resultado mostra perdas.
- Undo: EL11, ambas `pending`, aviso reaparece.
- Digivolve: Frigimon EL11, aviso desaparece.
- Mesma batalha: seletor oferece Nova Blast/SubzeroIcePunch. Confirmar: Frigimon EL12 possui ambas.

A inspeção visual confirmou o estilo informativo do tema. Nenhum armazenamento do usuário foi lido ou alterado nessa página de QA.

## Comandos

```text
node tests/generateRouteFixtures.cjs
node --test tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/theme.test.cjs tests/routeExport.test.cjs tests/rankLearning.test.cjs
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run build
npm run lint
git diff --check
```

## Arquivos alterados ou criados

- `docs/phase-2j-a/VALIDATION.md`
- `src/components/run-planner/BattleLearningWarnings.tsx`
- `src/components/run-planner/BattleRecordControls.tsx`
- `src/components/run-planner/BattleSelector.tsx`
- `src/components/run-planner/export/RouteDocument.tsx`
- `src/components/run-planner/RunHistory.tsx`
- `src/components/run-planner/RunPlanner.tsx`
- `src/types/runPlanner.ts`
- `src/utils/battleLearningWarnings.ts`
- `src/utils/battleTechniqueChoices.ts`
- `src/utils/battleTechniqueProgression.ts`
- `src/utils/learningMilestones.ts`
- `src/utils/routeDocument.ts`
- `src/utils/runBattleRecording.ts`
- `src/utils/runEventValidation.ts`
- `src/utils/runProgression.ts`
- `src/utils/runTransitionValidation.ts`
- `src/utils/techniqueInheritance.ts`
- `tests/fixtures/route-long.json`
- `tests/fixtures/route-snow-evolved.json`
- `tests/fixtures/route-snow-ready.json`
- `tests/generateRouteFixtures.cjs`
- `tests/rank-learning-preview.html`
- `tests/rankLearning.test.cjs`
- `tests/RankLearningPreview.tsx`
- `tests/runPlanner.test.cjs`
- `tests/runPlannerHardening.test.cjs`

## Pendências

Nenhuma pendência funcional conhecida no escopo. Lint continua com a baseline preexistente; saves de desenvolvimento que dependiam do bug não recebem migração. Fórmulas de XP, stats, caps, DP, DNA, Trade, captura, alvos de evolução, aliases e limite de 12 técnicas permanecem inalteradas.
