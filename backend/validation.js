export const PRIORITIES = ['high', 'medium', 'low'];

export function isValidTask(task) {
  return Boolean(
    task &&
    typeof task === 'object' &&
    !Array.isArray(task) &&
    typeof task.title === 'string' &&
    task.title.trim() !== '' &&
    typeof task.description === 'string' &&
    PRIORITIES.includes(task.priority) &&
    typeof task.estimatedMinutes === 'number' &&
    Number.isFinite(task.estimatedMinutes) &&
    task.estimatedMinutes > 0
  );
}

/**
 * Valida la respuesta completa de Gemini.
 * Devuelve un mensaje de error en español o '' si el contrato se cumple.
 */
export function validateTaskPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'La respuesta debe ser un objeto JSON.';
  }
  if (!Array.isArray(value.tasks)) {
    return 'La propiedad "tasks" debe ser un arreglo.';
  }
  if (value.tasks.length === 0) {
    return 'La propiedad "tasks" debe contener al menos una tarea.';
  }

  for (const [index, task] of value.tasks.entries()) {
    const taskNumber = index + 1;
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      return `La tarea ${taskNumber} debe ser un objeto.`;
    }
    if (typeof task.title !== 'string' || task.title.trim() === '') {
      return `La tarea ${taskNumber} debe tener un título no vacío.`;
    }
    if (typeof task.description !== 'string') {
      return `La descripción de la tarea ${taskNumber} debe ser texto.`;
    }
    if (!PRIORITIES.includes(task.priority)) {
      return `La prioridad de la tarea ${taskNumber} debe ser high, medium o low.`;
    }
    if (
      typeof task.estimatedMinutes !== 'number' ||
      !Number.isFinite(task.estimatedMinutes) ||
      task.estimatedMinutes <= 0
    ) {
      return `La duración estimada de la tarea ${taskNumber} debe ser un número positivo.`;
    }
  }

  return '';
}
