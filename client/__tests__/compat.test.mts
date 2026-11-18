import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_LABEL, classifyVersion, compatibilityNotice, parsePaseoVersion } from '../compat';

const ua = (version: string) => `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Paseo/${version} Chrome/152.0.7977.76 Electron/44.2.0 Safari/537.36`;

test('reads the app version from the Electron user agent', () => {
  assert.equal(parsePaseoVersion(ua('0.14.0')), '0.14.0');
  assert.equal(parsePaseoVersion(ua('0.15.0-beta.2')), '0.15.0-beta.2');
  assert.equal(parsePaseoVersion('Mozilla/5.0 Chrome/152.0 Safari/537.36'), null);
  assert.equal(parsePaseoVersion('NotPaseo/9.9.9'), null);
  assert.equal(parsePaseoVersion(null), null);
});

test('every patch of a verified minor is verified; the next minor is newer', () => {
  assert.equal(classifyVersion('0.13.2'), 'verified');
  assert.equal(classifyVersion('0.14.0'), 'verified');
  assert.equal(classifyVersion('0.16.9'), 'verified');
  assert.equal(classifyVersion('0.17.0'), 'newer');
  assert.equal(classifyVersion('0.17.0-beta.1'), 'newer');
  assert.equal(classifyVersion('1.0.0'), 'newer');
  assert.equal(classifyVersion('0.13.1'), 'older');
});

test('only unverified releases produce a notice', () => {
  assert.equal(compatibilityNotice(null), null);
  assert.equal(compatibilityNotice('0.16.1'), null);
  assert.match(compatibilityNotice('0.17.0')!, /0\.17\.0 has not been verified/);
  assert.match(compatibilityNotice('0.17.0')!, new RegExp(VERIFIED_LABEL.replace('.', '\\.')));
  assert.match(compatibilityNotice('0.13.0')!, /may not work/);
});
