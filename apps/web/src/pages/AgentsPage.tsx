import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RadioTower, UsersRound } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, humanize } from '../lib/format.js';
import type { Agent, AgentPresence } from '../types.js';

const editablePresences: AgentPresence[] = ['AVAILABLE', 'BREAK', 'WRAP_UP', 'OFFLINE'];

export function AgentsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiRequest<{ items: Agent[] }>('/api/v1/agents', {}, token),
    refetchInterval: 15_000,
  });
  const mutation = useMutation({
    mutationFn: ({ id, presence }: { id: string; presence: AgentPresence }) =>
      apiRequest<Agent>(
        `/api/v1/agents/${id}/presence`,
        { method: 'PATCH', body: JSON.stringify({ presence }) },
        token,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return <ErrorState message="Agent state could not be loaded." />;
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workforce / Presence"
        title="Agents"
        description="Twelve fictional agents demonstrate team membership, provider extensions, skills, and live availability."
        actions={
          <div className="summary-chip">
            <UsersRound size={16} /> {query.data.items.length} enabled agents
          </div>
        }
      />

      {mutation.isError ? <div className="inline-alert">{mutation.error.message}</div> : null}
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Team</th>
                <th>Skills</th>
                <th>Extension</th>
                <th>Presence</th>
                <th>Capacity</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <div className="identity-cell">
                      <div className="table-avatar">
                        {agent.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{agent.displayName}</strong>
                        <span>{agent.externalId}</span>
                      </div>
                    </div>
                  </td>
                  <td>{agent.teamName}</td>
                  <td>
                    <div className="tag-list">
                      {agent.skills.map((skill) => (
                        <span className="tag" key={skill}>
                          {humanize(skill)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="mono">
                      <RadioTower size={14} /> {agent.extension}
                    </span>
                  </td>
                  <td>
                    {canEdit && !['ON_CALL', 'RESERVED'].includes(agent.presence) ? (
                      <select
                        className="presence-select"
                        value={agent.presence}
                        disabled={mutation.isPending}
                        onChange={(event) =>
                          mutation.mutate({
                            id: agent.id,
                            presence: event.target.value as AgentPresence,
                          })
                        }
                        aria-label={`Presence for ${agent.displayName}`}
                      >
                        {editablePresences.map((presence) => (
                          <option key={presence} value={presence}>
                            {humanize(presence)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge value={agent.presence} />
                    )}
                  </td>
                  <td>
                    {agent.activeCallCount} / {agent.maxConcurrentCalls}
                  </td>
                  <td className="muted-cell">{formatDateTime(agent.lastPresenceChangeAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
