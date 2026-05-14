import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../src/slug.js';

test('lowercase ASCII passes through', () => {
  assert.equal(slug('hello world'), 'hello-world');
});

test('umlauts folded ASCII-style', () => {
  assert.equal(slug('Müller GmbH'), 'mueller-gmbh');
});

test('eszett folded to ss', () => {
  assert.equal(slug('Großhandel'), 'grosshandel');
});

test('strips reserved filesystem chars', () => {
  assert.equal(slug('a/b:c*d?'), 'a-b-c-d');
});

test('collapses runs of dashes', () => {
  assert.equal(slug('a  -- b'), 'a-b');
});

test('trims leading/trailing dashes', () => {
  assert.equal(slug('-x-'), 'x');
});

test('truncates to 30 chars', () => {
  assert.equal(slug('a'.repeat(50)).length, 30);
});

test('empty input returns "untitled"', () => {
  assert.equal(slug(''), 'untitled');
  assert.equal(slug('   '), 'untitled');
});
