import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const levels = { app: 5, screens: 4, widgets: 3, features: 2, entities: 1, components: 0, hooks: 0, lib: 0 };
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(resolve(dir,e.name)) : /\.[cm]?[jt]sx?$/.test(e.name) ? [resolve(dir,e.name)] : []);
}
test('FSD: dependencias descendentes y acceso por interfaces públicas', () => {
  for (const layer of Object.keys(levels)) for (const file of files(resolve(root,layer))) {
    const source = relative(root,file).replaceAll('\\','/').split('/');
    for (const match of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const target = relative(root,spec.startsWith('@/') ? resolve(root,spec.slice(2)) : resolve(dirname(file),spec)).replaceAll('\\','/').split('/');
      const targetLevel=levels[target[0]];
      if(targetLevel === undefined) continue;
      assert.ok(targetLevel <= levels[layer], `${source.join('/')} no puede importar ${spec}`);
      if (['screens','widgets','features','entities'].includes(layer) && layer === target[0]) assert.equal(source[1],target[1],`Importación lateral prohibida: ${spec}`);
      if (['screens','widgets','features','entities'].includes(target[0]) && !(source[0] === target[0] && source[1] === target[1])) {
        assert.ok(target.length === 2 || (target.length === 3 && /^index(?:\.ts)?$/.test(target[2])),`Usar API pública: ${spec}`);
      }
      if(layer === 'entities') assert.ok(!/from\s*['"]react/.test(readFileSync(file,'utf8')), 'Las entidades deben poder probarse sin React');
    }
  }
});
