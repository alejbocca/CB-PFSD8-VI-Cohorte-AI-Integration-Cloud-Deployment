import { useState } from 'react';
import './estilos-inexistentes.css';

const PRIORITIES = ['high', 'medium', 'low'];

function isValidTask(task) {
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

export default function App() {
  const [objective, setObjective] = useState('Quiero aprender React en una semana');
  const [tasks, setTasks] = useState([]);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateTasks(event) {
    event?.preventDefault();
    if (!objective.trim()) { setError('Escribe un objetivo antes de continuar.'); return; }
    setLoading(true); setError(''); setTasks([]); setRaw('');
    try {
      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective }),
      });
      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`El servidor devolvió una respuesta ilegible (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(data.error || `No se pudo consultar Gemini (HTTP ${response.status}).`);
      if (!Array.isArray(data.tasks)) throw new Error('El servidor devolvió un plan con formato inválido.');
      const validTasks = data.tasks.filter(isValidTask);
      if (validTasks.length === 0) throw new Error('El servidor no devolvió tareas válidas.');
      if (validTasks.length !== data.tasks.length) throw new Error('El servidor devolvió tareas con formato inválido.');
      setTasks(validTasks);
      setRaw(JSON.stringify({ tasks: validTasks }, null, 2));
    } catch (err) {
      const message = err instanceof TypeError
        ? 'No se pudo conectar con el servidor. Verifica que el backend esté activo y vuelve a intentarlo.'
        : err.message || 'Error inesperado';
      setError(message);
    } finally { setLoading(false); }
  }

  return <div className="page">
    <header className="topbar"><div className="brandmark">CB</div><div><strong>CODING BOOTCAMP</strong><span>ESPOL · AI Integration Lab</span></div><span className="tag">LAB 01</span></header>
    <main className="container">
      <div className="eyebrow">INTEGRACIÓN DE INTELIGENCIA ARTIFICIAL</div>
      <h1>De una idea a un plan con Gemini</h1>
      <p className="intro">Experimenta con prompts, respuestas estructuradas y pruebas de calidad. El modelo propone; tu aplicación valida.</p>
      <section className="panel">
        <h2>Describe tu objetivo</h2>
        <form onSubmit={generateTasks}>
          <label htmlFor="objective">Objetivo de aprendizaje o proyecto</label>
          <textarea id="objective" value={objective} onChange={e => setObjective(e.target.value)} rows="3" />
          <button disabled={loading}>{loading ? 'Consultando Gemini…' : 'Generar plan con IA'}</button>
        </form>
        {error && <div className="error-box" role="alert">
          <p className="error">{error}</p>
          <button type="button" className="retry" onClick={() => generateTasks()} disabled={loading}>
            Reintentar
          </button>
        </div>}
      </section>
      <section className="panel">
        <div className="section-title"><h2>Plan generado</h2><span>{tasks.length} tareas</span></div>
        {tasks.length === 0 ? <p className="muted">Las tareas aparecerán aquí después de consultar Gemini.</p> :
          <div className="task-grid">{tasks.map((task, index) => <article className="task" key={`${index}-${task.title}`}>
            <div className="task-top"><span>{String(index + 1).padStart(2, '0')}</span><span className="priority">{task.priority}</span></div>
            <h3>{task.title}</h3><p>{task.description}</p>
            <small>{task.estimatedMinutes} min estimados</small>
          </article>)}</div>}
      </section>
      <section className="panel"><h2>Respuesta del modelo</h2><p className="muted">Inspecciona el resultado para resolver los retos de validación.</p><pre>{raw || 'Todavía no hay respuesta.'}</pre></section>
      <footer>CODING BOOTCAMP · ESPOL · Material didáctico de laboratorio</footer>
    </main>
  </div>;
}
