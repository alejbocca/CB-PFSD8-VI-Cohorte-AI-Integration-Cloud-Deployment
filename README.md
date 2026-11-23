# Coding Bootcamp ESPOL — Laboratorio de Integración de IA

Proyecto base de aprendizaje: React + Vite + Node.js + Gemini. Identidad tipográfica educativa de Coding Bootcamp ESPOL (no contiene el logotipo institucional oficial).

## Requisitos
- Node.js 20 o superior
- Clave de Gemini API con acceso al modelo configurado

## 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Editar .env y configurar GEMINI_API_KEY
npm run dev
```
En Windows PowerShell, usar `Copy-Item .env.example .env`.

Para comprobar las reglas de validación del contrato sin usar la API:
```bash
cd backend
npm test
```

## 2. Frontend (segunda terminal)
```bash
cd frontend
npm install
npm run dev
```
Abrir http://localhost:5173. Vite reenvía `/api` a `http://localhost:3001` en desarrollo.

## Retos del taller
1. **Prompt engineering:** mejorar `buildPrompt()` en `backend/server.js`, comparar al menos 2 variantes y documentar resultados.
2. **Respuesta estructurada:** el backend solicita JSON con `responseMimeType` y `responseSchema`, analiza la salida y valida cada tarea antes de responder. React consume `tasks` como arreglo y muestra el error controlado del backend si la salida no cumple el contrato.
3. **Evaluación de IA:** ejecutar al menos 5 escenarios, registrar calidad/relevancia y demostrar manejo de errores.

### Contrato de respuesta (reto 2)

Cada elemento de `tasks` debe tener un título no vacío, una descripción de tipo texto, una prioridad `high`, `medium` o `low` y una duración numérica positiva. El endpoint devuelve `{ "tasks": [...] }` solo después de validar la salida del modelo; si no es JSON válido o incumple el contrato, responde HTTP 502 con un mensaje en `error`.

Ejemplo válido:
```json
{
  "tasks": [
    {
      "title": "Configurar el proyecto React",
      "description": "Crear la aplicación y revisar su estructura inicial.",
      "priority": "high",
      "estimatedMinutes": 45
    }
  ]
}
```

Ejemplo rechazado (la duración no es positiva):
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

## Consideraciones
- No publicar `backend/.env` ni exponer la API key en React.
- Desplegar solamente `frontend/dist` en S3 o Amplify **no despliega el backend**; para uso público se requiere un backend accesible por HTTPS y configurar la URL de API/CORS.
- El modelo Gemini disponible puede variar por cuenta y fecha; si falla, revisar `GEMINI_MODEL`.
