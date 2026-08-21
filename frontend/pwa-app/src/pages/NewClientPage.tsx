import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from '../api/client';

interface ClientResponse {
  id: string;
  name: string;
}

const DOC_TYPES = [
  { value: 'CC', label: 'Cédula (CC)' },
  { value: 'CE', label: 'Cédula extranjería (CE)' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PAS', label: 'Pasaporte (PAS)' },
] as const;

export function NewClientPage() {
  const [form, setForm] = useState({
    docType: 'CC',
    docNumber: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const created = await api.post<ClientResponse>('/clients', {
        docType: form.docType,
        docNumber: form.docNumber.trim(),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setSuccess(`Cliente "${created.name}" registrado correctamente.`);
      setForm({ docType: 'CC', docNumber: '', name: '', phone: '', email: '', address: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Nuevo cliente</h1>
      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="docType">Tipo de documento *</label>
          <select id="docType" value={form.docType} onChange={update('docType')}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="docNumber">Número de documento *</label>
          <input
            id="docNumber"
            value={form.docNumber}
            onChange={update('docNumber')}
            required
            minLength={3}
            maxLength={20}
          />
        </div>

        <div className="field span-2">
          <label htmlFor="name">Nombre / razón social *</label>
          <input
            id="name"
            value={form.name}
            onChange={update('name')}
            required
            minLength={2}
            maxLength={120}
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Teléfono</label>
          <input id="phone" value={form.phone} onChange={update('phone')} maxLength={20} />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={update('email')}
            maxLength={120}
          />
        </div>

        <div className="field span-2">
          <label htmlFor="address">Dirección</label>
          <input id="address" value={form.address} onChange={update('address')} maxLength={200} />
        </div>

        {error && <p className="alert alert-error span-2">{error}</p>}
        {success && <p className="alert alert-ok span-2">{success}</p>}

        <div className="span-2">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </section>
  );
}
