import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeObjective, validateObjective } from './objective.js';

test('rechaza una entrada vacía o solo espacios', () => {
  assert.notEqual(validateObjective(''), '');
  assert.notEqual(validateObjective('   '), '');
  assert.notEqual(validateObjective(undefined), '');
  assert.notEqual(validateObjective(42), '');
});

test('rechaza un saludo o un objetivo demasiado general', () => {
  assert.match(validateObjective('Hola'), /demasiado general/);
  assert.match(validateObjective('Hola, ¿qué tal?'), /demasiado general/);
  assert.match(validateObjective('Ayuda'), /demasiado general/);
});

test('rechaza objetivos de más de 1200 caracteres', () => {
  assert.match(validateObjective('a'.repeat(1201)), /demasiado largo/);
});

test('acepta objetivos concretos', () => {
  assert.equal(validateObjective('Aprender React en siete días'), '');
  assert.equal(validateObjective('Crear una tienda online'), '');
  assert.equal(validateObjective('  Aprender React en siete días  '), '');
});

test('normaliza espacios externos', () => {
  assert.equal(normalizeObjective('  Crear una tienda online  '), 'Crear una tienda online');
  assert.equal(normalizeObjective(null), '');
});
