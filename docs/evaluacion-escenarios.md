# Evaluación de escenarios — Integración de IA

Documento del Taller 2. Fecha de ejecución: 23 de noviembre de 2026.
Modelo evaluado: `gemini-2.5-flash` (vía `GEMINI_MODEL`). Endpoint: `POST /api/generate-tasks`.

Una respuesta HTTP `200` solo demuestra que el servicio respondió; **no** que el plan sea útil.
Por eso cada prueba registra, además del estado HTTP, la relevancia y el orden de las tareas.

## Método

1. Se enviaron objetivos al backend real (sin mocks) y se midió el tiempo de respuesta.
2. Se revisó el contenido: ¿las tareas pertenecen al objetivo?, ¿están secuenciadas?, ¿las duraciones son razonables?
3. Se probaron entradas inválidas y fallos del servicio, comprobando que el error sea visible, comprensible y recuperable en React.

## Matriz de cinco pruebas

| # | Escenario | Resultado esperado | Resultado observado | Veredicto | Mejora propuesta |
| --- | --- | --- | --- | --- | --- |
| 1 | **«Aprender React en siete días»** | Tareas concretas, secuenciadas y repartidas en el plazo | `200` en 29,4 s. 6 tareas ordenadas por día (JS/JSX → componentes → `useState` → `useEffect` → Context → Router → proyecto final). Prioridades `high`/`medium`; 90–180 min por tarea. | ✅ Cumple | El plan cubre 7 días pero no pregunta el nivel previo ni las horas diarias; convendría un campo `day`/`order` explícito y validar que la suma de minutos quepa en el plazo. |
| 2 | **«Crear una tienda online»** | Tareas relevantes al objetivo de negocio | `200` en 40,6 s. 6 tareas coherentes: modelo de negocio y catálogo, plataforma y dominio, diseño, pagos y envíos, carga de productos, pruebas y lanzamiento. | ✅ Cumple | No distingue dependencias entre tareas ni menciona presupuesto/país; añadir `dependsOn` o subtareas y pedir contexto de negocio. |
| 3 | **«Hola»** | Solicitar un objetivo más específico sin gastar una llamada al modelo | `400` en 261 ms con: «El objetivo es demasiado general. Indica qué quieres lograr y en qué contexto o plazo…». La respuesta se produce **antes** de llamar a Gemini. | ✅ Cumple (tras mejora) | La regla es heurística (longitud, número de palabras y saludos). Podría complementarse con una segunda pasada del modelo, más costosa, o con una pregunta guiada en la UI. |
| 4 | **Entrada vacía** | No invocar a Gemini y avisar al usuario | El frontend bloquea el envío con «Escribe un objetivo antes de continuar.»; el backend también responde `400` en 4 ms si se le llama directamente. | ✅ Cumple | Deshabilitar el botón mientras el campo esté vacío y conservar el foco en el textarea para reducir clics inútiles. |
| 5 | **Respuesta inválida o fallo de API** | Error comprensible y recuperable, interfaz operativa | Cuerpo JSON malformado → `400 {"error":"El cuerpo de la solicitud no es JSON válido."}`. Modelo inexistente → `502 {"error":"Gemini rechazó la solicitud (404)."}`. Timeout real → `502 {"error":"Gemini tardó demasiado en responder."}`. En React el mensaje se muestra con `role="alert"`, aparece **Reintentar** y el botón vuelve a habilitarse. | ✅ Cumple | Reintento automático con espera exponencial para `502`/timeout, y separar errores de red de los del modelo para dar instrucciones distintas. |

## Evidencia de errores controlados

Comandos ejecutados contra el backend con `Invoke-WebRequest` (PowerShell):

```text
=== E3 «Hola» | HTTP 400 | 261 ms
{"error":"El objetivo es demasiado general. Indica qué quieres lograr y en qué contexto o plazo. Por ejemplo: «Aprender React en siete días» o «Crear una tienda online para mi negocio»."}

=== E4 entrada vacía | HTTP 400 | 4 ms
{"error":"Escribe un objetivo antes de continuar."}

=== E5 JSON malformado | HTTP 400 | 6 ms
{"error":"El cuerpo de la solicitud no es JSON válido."}

=== E5 modelo inexistente | HTTP 502 | 601 ms
{"error":"Gemini rechazó la solicitud (404)."}

=== E5 timeout real (antes de la mejora) | HTTP 502 | 30 422 ms
{"error":"Gemini tardó demasiado en responder."}
```

Los dos primeros casos ya no llegan a Gemini; el tercero evita que Express devuelva una página HTML con el *stack trace*; el cuarto demuestra que un fallo del proveedor se traduce a un mensaje en español.

### Timeout: hallazgo y corrección

En la primera ejecución del escenario 1 el backend abortó a los 30 s (`502`, «Gemini tardó demasiado en responder»). Al repetir la prueba, el plan llegó a los 29,4 s, y el escenario 2 tardó 40,6 s: el límite de 30 s era demasiado ajustado. Se elevó a **60 s** en `backend/server.js`. Esto confirma que un `200` tardío es preferible a un fallo falso, pero también que la latencia debe comunicarse en la UI.

### JSON malformado: hallazgo y corrección

Antes de la mejora, enviar `{"objective":` devolvía un `400` con el HTML de error de Express y el *stack trace*. Se añadió un middleware que responde JSON y cubre también cuerpos mayores a 20 KB (`413`).

## Cambios realizados

| Archivo | Cambio |
| --- | --- |
| `backend/objective.js` | Valida el objetivo antes de llamar a Gemini: vacío, demasiado largo, saludo o demasiado general. |
| `backend/objective.test.js` | 5 pruebas de la validación de objetivos (incluye «Hola» y entradas concretas). |
| `backend/server.js` | Timeout de 60 s, middleware de errores de `express.json` y uso de `validateObjective`. |
| `frontend/src/App.jsx` | Lectura defensiva de la respuesta (JSON ilegible, error de red) y botón **Reintentar**. |
| `frontend/src/styles.css` | Estilo del bloque de error con botón de reintento. |

Pruebas automáticas: `cd backend && npm test` → **15 pruebas, 0 fallos**.
Compilación del frontend: `cd frontend && npm run build` → correcta.

## Reflexión sobre los límites del modelo

Validar el contrato no basta: el JSON puede ser perfecto y contener tareas genéricas, duplicadas o con duraciones irreales.  
El modelo no conoce el nivel, el presupuesto ni el contexto del usuario, así que rellena huecos con supuestos plausibles.  
Tampoco es determinista: el mismo objetivo produce planes distintos y la latencia varió entre 29 y 41 segundos.  
Un límite de timeout fijo siempre es arbitrario; conviene informar la espera y permitir reintentar.  
La salida estructurada reduce el riesgo de formato, pero no garantiza relevancia ni calidad pedagógica.  
Evaluar el contenido requiere una rúbrica humana o un juez automático, no solo validar tipos y rangos.  
Las salvaguardas deterministas evitan llamadas innecesarias, aunque son heurísticas y pueden fallar en casos límite.  
En producción añadiría límites de uso, registro de latencia y una métrica de calidad por escenario.

