import { useQuery } from '@tanstack/react-query';
import { Fingerprint } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, humanize } from '../lib/format.js';
import type { AuditEvent } from '../types.js';

export function AuditPage() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => apiRequest<{ items: AuditEvent[] }>('/api/v1/audit/events?limit=100', {}, token),
    refetchInterval: 15_000,
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState message="The audit trail could not be loaded for this role." />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Governance / Evidence"
        title="Audit trail"
        description="Append-only evidence links actor, action, resource, source address, and correlation ID for sensitive control-plane changes."
        actions={
          <div className="summary-chip">
            <Fingerprint size={16} /> {query.data.items.length} events
          </div>
        }
      />
      <section className="panel table-panel">
        {query.data.items.length === 0 ? (
          <EmptyState message="No audit events have been recorded." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Resource</th>
                  <th>Correlation ID</th>
                  <th>Source</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{humanize(event.action)}</strong>
                    </td>
                    <td>{event.actorEmail ?? 'System'}</td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{humanize(event.resourceType)}</strong>
                        <span className="mono">{event.resourceId ?? '—'}</span>
                      </div>
                    </td>
                    <td className="mono correlation-cell">{event.correlationId ?? '—'}</td>
                    <td className="mono">{event.sourceIp ?? 'internal'}</td>
                    <td className="muted-cell">{formatDateTime(event.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="architecture-note">
        <Fingerprint size={19} />
        <div>
          <strong>Append-only by database trigger</strong>
          <p>
            Application roles can insert evidence but PostgreSQL rejects updates and deletes on the
            audit table, protecting the trail from accidental mutation.
          </p>
        </div>
      </section>
    </div>
  );
}
