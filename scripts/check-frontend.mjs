#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['index.html', 'articles.html', 'statistiques.html', 'assets/js'];
const CONFLICT_MARKERS = ['<<<<<<<', '=======', '>>>>>>>'];
let hasError = false;

function walk(path) {
  const fullPath = join(ROOT, path);
  if (statSync(fullPath).isDirectory()) {
    return readdirSync(fullPath).flatMap((entry) => walk(join(path, entry)));
  }
  return [path];
}

function fail(message) {
  hasError = true;
  console.error(`✗ ${message}`);
}

function importedNames(source) {
  const names = new Set();
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
  for (const match of source.matchAll(namedImportRegex)) {
    for (const rawName of match[1].split(',')) {
      const cleaned = rawName.trim().replace(/\s+as\s+/i, ' ');
      const localName = cleaned.split(/\s+/).pop();
      if (localName) names.add(localName);
    }
  }
  return names;
}

function locallyDeclaredNames(source) {
  const names = new Set();
  const declarationRegex = /(?:^|\n)\s*(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(declarationRegex)) {
    names.add(match[1]);
  }
  return names;
}

for (const file of TARGETS.flatMap(walk)) {
  if (!/\.(?:html|js)$/.test(file)) continue;
  const source = readFileSync(join(ROOT, file), 'utf8');

  for (const marker of CONFLICT_MARKERS) {
    if (source.includes(marker)) fail(`${file} contient encore un marqueur de conflit (${marker})`);
  }

  if (file.endsWith('.js')) {
    try {
      execFileSync(process.execPath, ['--check', file], { cwd: ROOT, stdio: 'pipe' });
    } catch (error) {
      fail(`${file} ne passe pas node --check:\n${error.stderr?.toString() || error.message}`);
    }

    const imports = importedNames(source);
    const declarations = locallyDeclaredNames(source);
    for (const name of imports) {
      if (declarations.has(name)) {
        fail(`${file} importe puis redéclare "${name}" dans le même module`);
      }
    }
  }
}

if (hasError) process.exit(1);
console.log('✓ Frontend sans conflits, sans redéclarations import/locales et syntaxe JS valide.');
