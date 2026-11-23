import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTask, validateTaskPayload } from './validation.js';

const validTask = {
  title: 'Configurar el proyecto React',
  description: 'Crear la aplicación y revisar su estructura inicial.',
  priority: 'high',
  estimatedMinutes: 45,
};

test('acepta un payload válido', () => {
  assert.equal(validateTaskPayload({ tasks: [validTask] }), '');
});

test('rechaza una respuesta que no es objeto', () => {
  assert.equal(validateTaskPayload(null), 'La respuesta debe ser un objeto JSON.');
  assert.equal(validateTaskPayload([]), 'La respuesta debe ser un objeto JSON.');
  assert.equal(validateTaskPayload('texto'), 'La respuesta debe ser un objeto JSON.');
});

test('rechaza tasks que no es arreglo', () => {
  assert.equal(validateTaskPayload({ tasks: {} }), 'La propiedad "tasks" debe ser un arreglo.');
});

test('rechaza un arreglo de tareas vacío', () => {
  assert.equal(
    validateTaskPayload({ tasks: [] }),
    'La propiedad "tasks" debe contener al menos una tarea.'
  );
});

test('rechaza tareas que no son objetos', () => {
  assert.equal(validateTaskPayload({ tasks: [null] }), 'La tarea 1 debe ser un objeto.');
});

test('rechaza un título vacío', () => {
  assert.equal(
    validateTaskPayload({ tasks: [{ ...validTask, title: '   ' }] }),
    'La tarea 1 debe tener un título no vacío.'
  );
});

test('rechaza una descripción que no es texto', () => {
  assert.equal(
    validateTaskPayload({ tasks: [{ ...validTask, description: 12 }] }),
    'La descripción de la tarea 1 debe ser texto.'
  );
});

test('rechaza una prioridad inválida', () => {
  assert.equal(
    validateTaskPayload({ tasks: [{ ...validTask, priority: 'urgent' }] }),
    'La prioridad de la tarea 1 debe ser high, medium o low.'
  );
});

test('rechaza duraciones no positivas o no numéricas', () => {
  for (const estimatedMinutes of [0, -5, '30', Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      validateTaskPayload({ tasks: [{ ...validTask, estimatedMinutes }] }),
      'La duración estimada de la tarea 1 debe ser un número positivo.'
    );
  }
});

test('isValidTask coincide con las reglas del contrato', () => {
  assert.equal(isValidTask(validTask), true);
  assert.equal(isValidTask({ ...validTask, title: '' }), false);
  assert.equal(isValidTask({ ...validTask, estimatedMinutes: 0 }), false);
});
