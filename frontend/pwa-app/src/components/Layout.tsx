import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">POS MVP</span>
        {user && (
          <>
            <nav className="nav">
              <NavLink to="/" end>
                Inicio
              </NavLink>
              {(user.role === 'vendedor' || user.role === 'admin') && (
                <NavLink to="/clientes/nuevo">Nuevo cliente</NavLink>
              )}
              {user.role === 'admin' && <NavLink to="/admin">Administración</NavLink>}
            </nav>
            <div className="user-box">
              <span className="user-name">
                {user.username} · {ROLE_LABEL[user.role]}
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Salir
              </button>
            </div>
          </>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
