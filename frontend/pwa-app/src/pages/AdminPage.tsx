import { useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';

interface SaleRow {
  id: string;
  clientId: string;
  sellerId: string;
  total: string;
  status: string;
  createdAt: string;
  items: Array<{ productId: string; quantity: number; unitPrice: string }>;
}

/**
 * Fase 1: los módulos de usuarios y ventas están en construcción.
 * Esta página solo prueba la conectividad con sales-service a través de Kong.
 */
export function AdminPage() {
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: SaleRow[]; total: number }>('/sales')
      .then((res) => setSales(res.items))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Error de red al consultar ventas'),
      );
  }, []);

  return (
    <section>
      <h1>Administración</h1>
      <div className="card-grid">
        <div className="card">
          <h2>Usuarios</h2>
          <p className="muted">Módulo en construcción (fase 2). API lista en /api/v1/users.</p>
        </div>
        <div className="card">
          <h2>Ventas</h2>
          <p className="muted">Módulo en construcción (fase 2). Prueba de conectividad:</p>
          {error && <p className="alert alert-error">{error}</p>}
          {sales && (
            <p>
              Ventas registradas: <strong>{sales.length}</strong>
            </p>
          )}
          {!sales && !error && <p className="muted">Consultando…</p>}
        </div>
      </div>
    </section>
  );
}
