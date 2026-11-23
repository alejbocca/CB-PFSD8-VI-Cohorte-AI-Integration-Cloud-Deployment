import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PRIORITIES, validateTaskPayload } from './validation.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));

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
          priority: { type: 'STRING', enum: PRIORITIES },
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

function extractText(payload) {
  return payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
}

app.post('/api/generate-tasks', async (req, res) => {
  const objective = typeof req.body?.objective === 'string' ? req.body.objective.trim() : '';
  if (!objective || objective.length > 1200) {
    return res.status(400).json({ error: 'Objetivo inválido (1 a 1200 caracteres).' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Configura GEMINI_API_KEY en backend/.env' });
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(objective) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: TASK_RESPONSE_SCHEMA,
            temperature: 0.4,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error('Gemini auth error:', payload?.error?.message || responseText.slice(0, 300));
        return res.status(502).json({
          error: 'Gemini rechazó la autenticación. Configura una clave válida en backend/.env.',
        });
      }
      console.error('Gemini request error:', response.status, payload?.error?.message || responseText.slice(0, 300));
      return res.status(502).json({ error: `Gemini rechazó la solicitud (${response.status}).` });
    }

    if (!payload) {
      return res.status(502).json({ error: 'Gemini devolvió una respuesta ilegible.' });
    }

    const rawText = extractText(payload);
    if (!rawText) {
      const blockReason = payload.promptFeedback?.blockReason;
      return res.status(502).json({
        error: blockReason
          ? `Gemini bloqueó la solicitud (${blockReason}).`
          : 'Gemini no devolvió contenido de texto.',
      });
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
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(502).json({ error: 'Gemini tardó demasiado en responder.' });
    }
    console.error('Unexpected Gemini error:', error);
    return res.status(502).json({ error: 'No se pudo contactar a Gemini.' });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API ESPOL lista en http://localhost:${port}`));
