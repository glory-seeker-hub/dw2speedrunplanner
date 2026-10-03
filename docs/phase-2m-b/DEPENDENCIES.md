# Dependency review

Audit snapshot: 2026-09-28; reachability review completed 2026-10-02. 52 affected package records: 29 high, 18 moderate, 5 low, 0 critical. These include transitive propagation. See [structured evidence](dependency-audit.json) for installed versions, every advisory URL/range and individual recommendations. No audit fix, install or package upgrade was performed.

The application import graph contains 195 local modules and excludes the unused chart/Recharts component. React Router is bundled but only fixed BrowserRouter routes are used; no SSR/data-router hydration or untrusted redirects/navigation were found. No production exploit was demonstrated. This is a contextual review, not a guarantee of absence of vulnerabilities. Development tooling advisories remain relevant to maintainers even though static hosting does not run those servers or parsers.

| Package | npm severity | Dependency tree | Production reachability | Recommendation |
|---|---|---|---|---|
| `@eslint-community/eslint-utils` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@eslint/config-array` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@eslint/eslintrc` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@humanfs/node` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@remix-run/router` | high | production-or-shared-tree | Router bundled; vulnerable entry path not found | Separate security update, priority |
| `@tailwindcss/typography` | low | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@typescript-eslint/eslint-plugin` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@typescript-eslint/parser` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@typescript-eslint/type-utils` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@typescript-eslint/typescript-estree` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@typescript-eslint/utils` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `@vitejs/plugin-react-swc` | low | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `ajv` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `anymatch` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `autoprefixer` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `brace-expansion` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `browserslist` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `chokidar` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `esbuild` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `eslint` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `eslint-plugin-react-hooks` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `eslint-plugin-react-refresh` | moderate | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `fast-glob` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `file-entry-cache` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `flat-cache` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `flatted` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `glob` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `js-yaml` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `lodash` | high | production-or-shared-tree | Unused chart dependency | Separate maintenance update/review |
| `lovable-tagger` | low | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `micromatch` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `minimatch` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `nanoid` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `picomatch` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss-import` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss-js` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss-load-config` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss-nested` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `postcss-selector-parser` | low | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `react-router` | high | production-or-shared-tree | Router bundled; vulnerable entry path not found | Separate security update, priority |
| `react-router-dom` | high | production-or-shared-tree | Router bundled; vulnerable entry path not found | Separate security update, priority |
| `readdirp` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `recharts` | moderate | production-or-shared-tree | Unused chart dependency | Separate maintenance update/review |
| `rollup` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `sucrase` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `tailwindcss` | high | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `tailwindcss-animate` | low | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
| `typescript-eslint` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `update-browserslist-db` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `vite` | high | dev | Build/lint/CSS tooling only | Separate maintenance update/review |
| `yaml` | moderate | production-or-shared-tree | Build/lint/CSS tooling only | Separate maintenance update/review |
