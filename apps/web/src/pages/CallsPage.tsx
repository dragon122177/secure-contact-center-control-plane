import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, maskPhoneNumber } from '../lib/format.js';
import type { Call, CallStatus } from '../types.js';

const filters: Array<{ label: string; value: '' | CallStatus }> = [
  { label: 'All calls', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Waiting', value: 'QUEUED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Abandoned', value: 'ABANDONED' },
];

export function CallsPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState<'' | CallStatus>('');
  const query = useQuery({
    queryKey: ['calls', status],
    queryFn: () =>
      apiRequest<{ items: Call[]; total: number }>(
        `/api/v1/calls?limit=100${status ? `&status=${status}` : ''}`,
        {},
        token,
      ),
    refetchInterval: 10_000,
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations / Call lifecycle"
        title="Call operations"
        description="Provider events become idempotent state transitions, auditable history, and asynchronous domain events."
        actions={
          <div className="summary-chip">
            <PhoneCall size={16} /> {query.data?.total ?? 0} records
          </div>
        }
      />
      <div className="filter-tabs" role="tablist" aria-label="Call status filter">
        {filters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className={status === filter.value ? 'active' : ''}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message="Call records could not be loaded." /> : null}
      {query.data ? (
        <section className="panel table-panel">
          {query.data.items.length === 0 ? (
            <EmptyState message="No calls match this filter." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Provider call</th>
                    <th>Status</th>
                    <th>Queue</th>
                    <th>Agent</th>
                    <th>Caller</th>
                    <th>Started</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((call) => (
                    <tr key={call.id}>
                      <td>
                        <div className="stacked-cell">
                          <strong className="mono">{call.providerCallId}</strong>
                          <span>{call.direction}</span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge value={call.status} />
                      </td>
                      <td>{call.queueName ?? 'Unassigned'}</td>
                      <td>{call.agentName ?? <span className="muted-cell">Waiting</span>}</td>
                      <td className="mono">{maskPhoneNumber(call.callerNumber)}</td>
                      <td className="muted-cell">{formatDateTime(call.startedAt)}</td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{call.disposition ?? call.endedReason ?? 'In progress'}</strong>
                          <span>{call.tags.join(', ') || 'No tags'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
