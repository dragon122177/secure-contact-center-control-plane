import { useQuery } from '@tanstack/react-query';
import { Bot, Headphones, PhoneIncoming, PhoneOff, UsersRound } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatCard } from '../components/StatCard.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, formatDuration, humanize } from '../lib/format.js';
import type { Dashboard } from '../types.js';

export function OverviewPage() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/api/v1/dashboard', {}, token),
    refetchInterval: 15_000,
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState message="The operational summary could not be loaded." />;
  const dashboard = query.data;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations / Live wallboard"
        title="Contact center overview"
        description="Realtime workload, agent capacity, queue health, and automation status across the synthetic workspace."
        actions={
          <span className="updated-at">Updated {formatDateTime(dashboard.generatedAt)}</span>
        }
      />

      <section className="stats-grid" aria-label="Key operational metrics">
        <StatCard
          label="Available agents"
          value={dashboard.agents.available}
          detail={`${dashboard.agents.total} configured`}
          icon={UsersRound}
          tone="success"
        />
        <StatCard
          label="Active calls"
          value={dashboard.calls.active}
          detail={`${dashboard.calls.waiting} waiting`}
          icon={PhoneIncoming}
        />
        <StatCard
          label="Completed today"
          value={dashboard.calls.completed_today}
          detail="Synthetic call records"
          icon={Headphones}
        />
        <StatCard
          label="Abandoned today"
          value={dashboard.calls.abandoned_today}
          detail="Callback candidates"
          icon={PhoneOff}
          tone={dashboard.calls.abandoned_today > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Automation queue"
          value={dashboard.automations.pending}
          detail={`${dashboard.automations.failed} failed`}
          icon={Bot}
          tone={dashboard.automations.failed > 0 ? 'danger' : 'default'}
        />
      </section>

      <div className="overview-grid">
        <section className="panel panel-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live load</p>
              <h2>Queue health</h2>
            </div>
            <span className="panel-meta">SLA watch</span>
          </div>
          <div className="queue-health-list">
            {dashboard.queues.map((queue) => {
              const pressure = Math.min((queue.waitingCalls + queue.activeCalls) * 14, 100);
              return (
                <article className="queue-health-row" key={queue.queueId}>
                  <div>
                    <strong>{queue.displayName}</strong>
                    <span>
                      {queue.waitingCalls} waiting · {queue.activeCalls} active
                    </span>
                  </div>
                  <div className="pressure-track" aria-label={`${pressure}% queue pressure`}>
                    <span style={{ width: `${pressure}%` }} />
                  </div>
                  <div className="wait-metric">
                    <span>Avg. wait</span>
                    <strong>{formatDuration(queue.averageWaitSeconds)}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Traceability</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="activity-list">
            {dashboard.recentActivity.length === 0 ? (
              <EmptyState message="No activity recorded yet." />
            ) : null}
            {dashboard.recentActivity.map((event) => (
              <div className="activity-row" key={event.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{humanize(event.action)}</strong>
                  <span>
                    {event.actorEmail ?? 'System'} · {formatDateTime(event.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
