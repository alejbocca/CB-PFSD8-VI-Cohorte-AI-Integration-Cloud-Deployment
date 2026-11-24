# Contrato de respuesta estructurada con Gemini

Documento de referencia del Taller 2 — Integración de IA.

El backend solicita a Gemini un objeto JSON con una propiedad `tasks` (arreglo de tareas), valida el contrato y solo entonces responde al frontend. Si el formato no se cumple, devuelve un error controlado con HTTP `502`.

## Contrato

Cada elemento de `tasks` debe tener:

| Campo | Tipo | Regla |
| --- | --- | --- |
| `title` | texto | No vacío (se ignoran espacios) |
| `description` | texto | Puede estar vacío, pero debe ser string |
| `priority` | texto | Exactamente `high`, `medium` o `low` |
| `estimatedMinutes` | número | Finito y mayor que `0` |

Además:

- La raíz debe ser un objeto JSON (no arreglo ni `null`).
- `tasks` debe ser un arreglo con al menos una tarea.
- Cada elemento de `tasks` debe ser un objeto.

Endpoints y respuestas:

| Situación | HTTP | Cuerpo |
| --- | --- | --- |
| Todo válido | `200` | `{ "tasks": [...] }` |
| Objetivo vacío, demasiado general, saludo o demasiado largo | `400` | `{ "error": "..." }` |
| Cuerpo de la solicitud no es JSON o supera 20 KB | `400` / `413` | `{ "error": "..." }` |
| Falta `GEMINI_API_KEY` | `500` | `{ "error": "..." }` |
| Gemini rechaza, timeout o formato inválido | `502` | `{ "error": "..." }` |

---

## 1. Código de solicitud a Gemini

Archivo: `backend/server.js`

### Esquema de salida

```js
const TASK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tasks: {
      type: 'ARRAY',
      minItems: 1,
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          estimatedMinutes: { type: 'NUMBER', minimum: 1 },
        },
        required: ['title', 'description', 'priority', 'estimatedMinutes'],
        propertyOrdering: ['title', 'description', 'priority', 'estimatedMinutes'],
      },
    },
  },
  required: ['tasks'],
  propertyOrdering: ['tasks'],
};
```

### Prompt

```js
function buildPrompt(objective) {
  return `Crea un plan de tareas para el siguiente objetivo: "${objective}".

Devuelve exclusivamente un objeto JSON válido (sin markdown ni texto adicional) con esta forma:
{
  "tasks": [
    {
      "title": "texto no vacío",
      "description": "texto descriptivo",
      "priority": "high" | "medium" | "low",
      "estimatedMinutes": 30
    }
  ]
}

Reglas:
- "tasks" debe contener al menos una tarea.
- "title" no puede estar vacío.
- "description" debe ser texto.
- "priority" debe ser exactamente high, medium o low.
- "estimatedMinutes" debe ser un número positivo.`;
}
```

### Llamada HTTP con JSON estructurado

```js
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(objective) }] }],
      generationConfig: {
        responseMimeType: 'application/json', // exige JSON
        responseSchema: TASK_RESPONSE_SCHEMA, // esquema de salida
        temperature: 0.4,
      },
    }),
    signal: AbortSignal.timeout(60000),
  }
);
```

### Parseo y validación de la respuesta

```js
const rawText = payload.candidates?.[0]?.content?.parts
  ?.map(part => part.text || '')
  .join('') || '';

if (!rawText) {
  return res.status(502).json({ error: 'Gemini no devolvió contenido de texto.' });
}

let result;
try {
  result = JSON.parse(rawText);
} catch {
  return res.status(502).json({ error: 'Gemini devolvió una respuesta que no es JSON válido.' });
}

const validationError = validateTaskPayload(result);
if (validationError) {
  return res.status(502).json({
    error: `La respuesta de Gemini no cumple el formato requerido. ${validationError}`,
  });
}

return res.json({ tasks: result.tasks });
```

---

## 2. Código de validación

Archivo: `backend/validation.js`

```js
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
```

---

## 3. Ejemplo de JSON correcto

```json
{
  "tasks": [
    {
      "title": "Configurar el proyecto React",
      "description": "Crear la aplicación con Vite y revisar su estructura inicial.",
      "priority": "high",
      "estimatedMinutes": 45
    },
    {
      "title": "Practicar componentes y props",
      "description": "Construir tres componentes reutilizables y pasarles datos.",
      "priority": "medium",
      "estimatedMinutes": 90
    },
    {
      "title": "Publicar el avance",
      "description": "Subir el proyecto a GitHub y documentar los pasos.",
      "priority": "low",
      "estimatedMinutes": 30
    }
  ]
}
```

El backend responde `200`:

```json
{
  "tasks": [
    {
      "title": "Configurar el proyecto React",
      "description": "Crear la aplicación con Vite y revisar su estructura inicial.",
      "priority": "high",
      "estimatedMinutes": 45
    }
  ]
}
```

---

## 4. Ejemplos rechazados

### 4.1 Duración no positiva

```json
{
  "tasks": [
    {
      "title": "Configurar el proyecto React",
      "description": "Crear la aplicación.",
      "priority": "high",
      "estimatedMinutes": 0
    }
  ]
}
```

Respuesta `502`:

```json
{
  "error": "La respuesta de Gemini no cumple el formato requerido. La duración estimada de la tarea 1 debe ser un número positivo."
}
```

### 4.2 Título vacío

```json
{
  "tasks": [
    {
      "title": "   ",
      "description": "Crear la aplicación.",
      "priority": "high",
      "estimatedMinutes": 45
    }
  ]
}
```

Respuesta `502`:

```json
{
  "error": "La respuesta de Gemini no cumple el formato requerido. La tarea 1 debe tener un título no vacío."
}
```

### 4.3 Prioridad inválida

```json
{
  "tasks": [
    {
      "title": "Configurar el proyecto",
      "description": "Crear la aplicación.",
      "priority": "urgent",
      "estimatedMinutes": 45
    }
  ]
}
```

Respuesta `502`:

```json
{
  "error": "La respuesta de Gemini no cumple el formato requerido. La prioridad de la tarea 1 debe ser high, medium o low."
}
```

### 4.4 `tasks` no es arreglo

```json
{
  "tasks": { "title": "Configurar el proyecto" }
}
```

Respuesta `502`:

```json
{
  "error": "La respuesta de Gemini no cumple el formato requerido. La propiedad \"tasks\" debe ser un arreglo."
}
```

### 4.5 Arreglo vacío

```json
{ "tasks": [] }
```

Respuesta `502`:

```json
{
  "error": "La respuesta de Gemini no cumple el formato requerido. La propiedad \"tasks\" debe contener al menos una tarea."
}
```

### 4.6 Respuesta que no es JSON

```text
Aquí tienes tu plan:
- Configurar React
```

Respuesta `502`:

```json
{
  "error": "Gemini devolvió una respuesta que no es JSON válido."
}
```

---

## 5. Consumo en React

Archivo: `frontend/src/App.jsx`

```js
const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'No se pudo consultar Gemini');
}
if (!Array.isArray(data.tasks)) {
  throw new Error('El servidor devolvió un plan con formato inválido.');
}

const validTasks = data.tasks.filter(isValidTask);

if (validTasks.length === 0) {
  throw new Error('El servidor no devolvió tareas válidas.');
}
if (validTasks.length !== data.tasks.length) {
  throw new Error('El servidor devolvió tareas con formato inválido.');
}

setTasks(validTasks);
setRaw(JSON.stringify({ tasks: validTasks }, null, 2));
```

El error se muestra con:

```jsx
{error && <p role="alert" className="error">{error}</p>}
```

---

## 6. Pruebas

Las reglas de validación se prueban sin llamar a Gemini:

```bash
cd backend
npm test
```

Se cubren 10 casos: payload válido, raíz inválida, `tasks` no arreglo, `tasks` vacío, tarea no objeto, título vacío, descripción no texto, prioridad inválida, duración no positiva/no numérica y coherencia de `isValidTask`.

---

## Archivos relevantes

| Archivo | Función |
| --- | --- |
| `backend/server.js` | Prompt, esquema, llamada a Gemini y manejo de errores |
| `backend/objective.js` | Rechazo temprano de objetivos vacíos, muy largos o demasiado generales |
| `backend/validation.js` | Reglas del contrato |
| `backend/validation.test.js` | Pruebas de validación |
| `frontend/src/App.jsx` | Consumo defensivo y presentación de tareas |
