import { useQuery } from '@tanstack/react-query';
import { Clock3, Route, UsersRound } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDuration, humanize } from '../lib/format.js';
import type { Queue } from '../types.js';

export function QueuesPage() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ['queues'],
    queryFn: () => apiRequest<{ items: Queue[] }>('/api/v1/queues', {}, token),
    refetchInterval: 15_000,
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState message="Queue configuration could not be loaded." />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Routing / Configuration"
        title="Queues & routing"
        description="Skill requirements and least-recently-assigned capacity drive deterministic, provider-neutral routing decisions."
      />
      <section className="card-grid">
        {query.data.items.map((queue) => (
          <article className="queue-card" key={queue.id}>
            <div className="queue-card-top">
              <div className="queue-icon">
                <Route size={20} />
              </div>
              <span className={queue.enabled ? 'enabled-label' : 'disabled-label'}>
                {queue.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <h2>{queue.displayName}</h2>
            <p>{queue.description}</p>
            <div className="tag-list">
              {queue.requiredSkills.map((skill) => (
                <span className="tag tag-accent" key={skill}>
                  {humanize(skill)} required
                </span>
              ))}
            </div>
            <div className="queue-numbers">
              <div>
                <UsersRound size={17} />
                <span>Agents</span>
                <strong>
                  {queue.availableAgents} / {queue.memberCount}
                </strong>
              </div>
              <div>
                <Clock3 size={17} />
                <span>Avg. wait</span>
                <strong>{formatDuration(queue.averageWaitSeconds)}</strong>
              </div>
              <div>
                <Route size={17} />
                <span>Live load</span>
                <strong>{queue.waitingCalls + queue.activeCalls}</strong>
              </div>
            </div>
            <div className="sla-row">
              <span>Service target</span>
              <strong>{queue.serviceLevelSeconds}s</strong>
              <span>Max wait</span>
              <strong>{formatDuration(queue.maxWaitSeconds)}</strong>
            </div>
          </article>
        ))}
      </section>
      <section className="architecture-note">
        <Route size={19} />
        <div>
          <strong>Routing strategy: skill + idle time</strong>
          <p>
            Required skills are hard filters. Preferred skills, available capacity, and time since
            the last assignment produce a stable score with a deterministic tie-break.
          </p>
        </div>
      </section>
    </div>
  );
}
