// Production module graph: no gameplay or validation test doubles.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.url', JSON.stringify(require('node:url').pathToFileURL(file).href));
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (/\.(jpg|png)$/.test(id)) return id; // Asset URL only; no image decoding in component tests.
    if(id.startsWith('.')) { const base=path.resolve(path.dirname(file),id); return load(base+(fs.existsSync(base+'.ts')?'.ts':'.tsx')); }
    if (!id.startsWith('@/')) return require(id);
    const base = path.join('src', id.slice(2));
    return load(base + (fs.existsSync(path.resolve(root, base + '.ts')) ? '.ts' : '.tsx'));
  };
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}

module.exports = { load };

