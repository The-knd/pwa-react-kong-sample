import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../auth/AuthContext';
import { useAuth } from '../auth/AuthContext';

/**
 * Guarda de ruta: exige sesión y, opcionalmente, uno de los roles dados.
 * La autoridad real siempre está en el backend; esto solo guía la navegación.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="page-loading">Cargando…</p>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
