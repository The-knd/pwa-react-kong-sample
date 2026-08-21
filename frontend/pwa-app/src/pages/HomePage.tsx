import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section>
      <h1>Hola, {user.username}</h1>
      <p className="muted">Fase 1 del MVP: login y gestión básica de clientes.</p>

      <div className="card-grid">
        {(user.role === 'vendedor' || user.role === 'admin') && (
          <Link to="/clientes/nuevo" className="card card-action">
            <h2>Nuevo cliente</h2>
            <p className="muted">Registra un cliente para poder facturarle ventas.</p>
          </Link>
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className="card card-action">
            <h2>Administración</h2>
            <p className="muted">Usuarios y ventas (vista de conectividad).</p>
          </Link>
        )}
        {user.role === 'vendedor' && (
          <div className="card">
            <h2>Ventas</h2>
            <p className="muted">Módulo en construcción (fase 2 de la UI).</p>
          </div>
        )}
      </div>
    </section>
  );
}
