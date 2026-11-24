const MAX_LENGTH = 1200;
const MIN_CHARACTERS = 15;
const MIN_WORDS = 3;
const MAX_GREETING_WORDS = 5;

const GREETING_PATTERN = /^(hola|holi|hi|hello|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal|saludos|test|prueba|ayuda|help)\b/;

function simplify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Revisa el objetivo antes de gastar una llamada a Gemini.
 * Devuelve un mensaje de error en español o '' si el objetivo es aprovechable.
 */
export function validateObjective(value) {
  const objective = typeof value === 'string' ? value.trim() : '';

  if (!objective) {
    return 'Escribe un objetivo antes de continuar.';
  }
  if (objective.length > MAX_LENGTH) {
    return 'El objetivo es demasiado largo (máximo 1200 caracteres).';
  }

  const words = objective.split(/\s+/).filter(Boolean);
  const normalized = simplify(objective);
  const isGreeting = GREETING_PATTERN.test(normalized) && words.length <= MAX_GREETING_WORDS;
  if (words.length < MIN_WORDS || objective.length < MIN_CHARACTERS || isGreeting) {
    return 'El objetivo es demasiado general. Indica qué quieres lograr y en qué contexto o plazo. Por ejemplo: «Aprender React en siete días» o «Crear una tienda online para mi negocio».';
  }

  return '';
}

/**
 * Normaliza el objetivo para enviarlo al modelo.
 */
export function normalizeObjective(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export const OBJECTIVE_LIMITS = { MAX_LENGTH, MIN_CHARACTERS, MIN_WORDS };
