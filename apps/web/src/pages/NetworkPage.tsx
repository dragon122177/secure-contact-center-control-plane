import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Network, Router, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import type { Agent, NetworkPolicy, NetworkSession } from '../types.js';

type EvaluationResult = NetworkSession & { policy: NetworkPolicy | null };

export function NetworkPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState('');
  const [sourceIp, setSourceIp] = useState('10.44.18.22');
  const [managedDevice, setManagedDevice] = useState(true);
  const policies = useQuery({
    queryKey: ['network-policies'],
    queryFn: () =>
      apiRequest<{ items: NetworkPolicy[] }>('/api/v1/security/network-policies', {}, token),
  });
  const sessions = useQuery({
    queryKey: ['network-sessions'],
    queryFn: () =>
      apiRequest<{ items: NetworkSession[] }>(
        '/api/v1/security/network-sessions?limit=30',
        {},
        token,
      ),
  });
  const agents = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiRequest<{ items: Agent[] }>('/api/v1/agents', {}, token),
  });
  const evaluation = useMutation({
    mutationFn: () =>
      apiRequest<EvaluationResult>(
        '/api/v1/security/network-sessions/validate',
        {
          method: 'POST',
          body: JSON.stringify({
            agentId: agentId || agents.data?.items[0]?.id,
            sourceIp,
            deviceId: 'demo-managed-device',
            managedDevice,
          }),
        },
        token,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['network-sessions'] }),
  });
  const canEvaluate = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  function submit(event: FormEvent) {
    event.preventDefault();
    evaluation.mutate();
  }

  if (policies.isLoading || sessions.isLoading || agents.isLoading) return <LoadingState />;
  if (
    policies.isError ||
    sessions.isError ||
    agents.isError ||
    !policies.data ||
    !sessions.data ||
    !agents.data
  )
    return <ErrorState message="Network policy data could not be loaded." />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Security / Provider access"
        title="Network access"
        description="RelayOps records and evaluates access metadata; the VPN, proxy, and VoIP transport remain hosted by the external provider."
      />
      <section className="network-layout">
        <div className="policy-column">
          {policies.data.items.map((policy) => (
            <article className="policy-card" key={policy.id}>
              <div className="queue-card-top">
                <div className="queue-icon">
                  <ShieldCheck size={20} />
                </div>
                <span className={policy.enabled ? 'enabled-label' : 'disabled-label'}>
                  {policy.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <h2>{policy.name}</h2>
              <p>
                {policy.providerName} · {policy.accessType}
              </p>
              <div className="policy-ranges">
                {policy.allowedCidrs.map((cidr) => (
                  <code key={cidr}>{cidr}</code>
                ))}
              </div>
              <div className="policy-detail">
                <CheckCircle2 size={16} />
                <span>
                  {policy.requireManagedDevice ? 'Managed device required' : 'Any device posture'}
                </span>
              </div>
              <small>{policy.notes}</small>
            </article>
          ))}
        </div>
        {canEvaluate ? (
          <form className="panel access-form" onSubmit={submit}>
            <div className="form-heading">
              <div className="queue-icon">
                <Router size={19} />
              </div>
              <div>
                <h2>Evaluate demo access</h2>
                <p>Try 10.44.18.22 for allow or 203.0.113.10 for deny.</p>
              </div>
            </div>
            <label>
              <span>Agent</span>
              <select
                required
                value={agentId || agents.data.items[0]?.id || ''}
                onChange={(event) => setAgentId(event.target.value)}
              >
                {agents.data.items.map((agent) => (
                  <option value={agent.id} key={agent.id}>
                    {agent.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source IP</span>
              <input
                required
                value={sourceIp}
                onChange={(event) => setSourceIp(event.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={managedDevice}
                onChange={(event) => setManagedDevice(event.target.checked)}
              />
              <span>Managed device</span>
            </label>
            <button className="primary-button" type="submit" disabled={evaluation.isPending}>
              <Network size={17} /> {evaluation.isPending ? 'Evaluating…' : 'Evaluate policy'}
            </button>
            {evaluation.data ? (
              <div className={`decision-box decision-${evaluation.data.decision.toLowerCase()}`}>
                <StatusBadge value={evaluation.data.decision} />
                <strong>{evaluation.data.reason}</strong>
              </div>
            ) : null}
            {evaluation.isError ? (
              <div className="inline-alert">{evaluation.error.message}</div>
            ) : null}
          </form>
        ) : null}
      </section>
      <section className="panel table-panel">
        <div className="panel-heading panel-heading-padded">
          <div>
            <p className="eyebrow">Access evidence</p>
            <h2>Recent evaluations</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Decision</th>
                <th>Source</th>
                <th>Policy</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.data.items.map((session) => (
                <tr key={session.id}>
                  <td>{session.agentName}</td>
                  <td>
                    <StatusBadge value={session.decision} />
                  </td>
                  <td className="mono">{session.sourceIp}</td>
                  <td>{session.policyName ?? 'No match'}</td>
                  <td>{session.reason}</td>
                  <td className="muted-cell">{formatDateTime(session.connectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
