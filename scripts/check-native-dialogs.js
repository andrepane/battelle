#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export function executableSource(source) {
  let output = '', mode = 'code', quote = '', escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (mode === 'line') { if (char === '\n') { mode = 'code'; output += '\n'; } else output += ' '; continue; }
    if (mode === 'block') { if (char === '*' && next === '/') { output += '  '; index += 1; mode = 'code'; } else output += char === '\n' ? '\n' : ' '; continue; }
    if (mode === 'string') { output += char === '\n' ? '\n' : ' '; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) mode = 'code'; continue; }
    if (char === '/' && next === '/') { output += '  '; index += 1; mode = 'line'; continue; }
    if (char === '/' && next === '*') { output += '  '; index += 1; mode = 'block'; continue; }
    if (char === '"' || char === "'" || char === '`') { output += ' '; quote = char; mode = 'string'; continue; }
    output += char;
  }
  return output;
}

export function nativeDialogCalls(source) {
  const code = executableSource(source), pattern = /(?:\bwindow\s*\.\s*)?\b(alert|confirm|prompt)\s*\(/g;
  return [...code.matchAll(pattern)].map(match => ({ name: match[1], line: code.slice(0, match.index).split('\n').length }));
}

if (process.argv[1]?.endsWith('check-native-dialogs.js')) {
  const files = execFileSync('git', ['ls-files', '*.js'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).filter(file => existsSync(file) && file !== 'scripts/check-native-dialogs.js' && !file.startsWith('tests/native-dialog-audit.test.js'));
  const violations = files.flatMap(file => nativeDialogCalls(readFileSync(file, 'utf8')).map(call => `${file}:${call.line}: llamada nativa ${call.name}()`));
  if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
  else console.log(`Auditoría superada: ${files.length} archivos JavaScript versionados sin alert(), confirm() ni prompt().`);
}
