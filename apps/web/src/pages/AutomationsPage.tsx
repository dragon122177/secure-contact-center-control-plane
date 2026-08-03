import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Workflow } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorState, LoadingState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../lib/api.js';
import { formatDateTime, humanize } from '../lib/format.js';
import type { AutomationRule, AutomationRun } from '../types.js';

type RuleDraft = {
  name: string;
  triggerEvent: 'CALL_ENDED' | 'CALL_ABANDONED' | 'CALL_FAILED';
  actionType: 'ADD_TAG' | 'SET_DISPOSITION' | 'NOTIFY_SUPERVISOR';
  actionValue: string;
};

const initialDraft: RuleDraft = {
  name: '',
  triggerEvent: 'CALL_ENDED',
  actionType: 'ADD_TAG',
  actionValue: '',
};

export function AutomationsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(initialDraft);
  const rules = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => apiRequest<{ items: AutomationRule[] }>('/api/v1/automations/rules', {}, token),
  });
  const runs = useQuery({
    queryKey: ['automation-runs'],
    queryFn: () =>
      apiRequest<{ items: AutomationRun[] }>('/api/v1/automations/runs?limit=30', {}, token),
    refetchInterval: 15_000,
  });
  const createRule = useMutation({
    mutationFn: () =>
      apiRequest<AutomationRule>(
        '/api/v1/automations/rules',
        {
          method: 'POST',
          body: JSON.stringify({
            name: draft.name,
            description: 'Created from the RelayOps operations panel',
            triggerEvent: draft.triggerEvent,
            conditions: [],
            actions: [{ type: draft.actionType, value: draft.actionValue }],
          }),
        },
        token,
      ),
    onSuccess: () => {
      setDraft(initialDraft);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
  });
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  function submit(event: FormEvent) {
    event.preventDefault();
    createRule.mutate();
  }

  if (rules.isLoading || runs.isLoading) return <LoadingState />;
  if (rules.isError || runs.isError || !rules.data || !runs.data)
    return <ErrorState message="Automation data could not be loaded." />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workflow / Event-driven actions"
        title="Automations"
        description="Rules are evaluated after terminal call events; a separate worker executes actions with bounded retries."
        actions={
          canEdit ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowForm((value) => !value)}
            >
              <Plus size={17} /> New rule
            </button>
          ) : undefined
        }
      />

      {showForm ? (
        <form className="panel automation-form" onSubmit={submit}>
          <div className="form-heading">
            <div className="queue-icon">
              <Workflow size={19} />
            </div>
            <div>
              <h2>Create automation rule</h2>
              <p>The rule uses synthetic demo data only.</p>
            </div>
          </div>
          <label>
            <span>Rule name</span>
            <input
              required
              minLength={3}
              maxLength={120}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Tag resolved calls"
            />
          </label>
          <label>
            <span>Trigger</span>
            <select
              value={draft.triggerEvent}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  triggerEvent: event.target.value as RuleDraft['triggerEvent'],
                })
              }
            >
              <option value="CALL_ENDED">Call ended</option>
              <option value="CALL_ABANDONED">Call abandoned</option>
              <option value="CALL_FAILED">Call failed</option>
            </select>
          </label>
          <label>
            <span>Action</span>
            <select
              value={draft.actionType}
              onChange={(event) =>
                setDraft({ ...draft, actionType: event.target.value as RuleDraft['actionType'] })
              }
            >
              <option value="ADD_TAG">Add tag</option>
              <option value="SET_DISPOSITION">Set disposition</option>
              <option value="NOTIFY_SUPERVISOR">Notify supervisor</option>
            </select>
          </label>
          <label className="form-grow">
            <span>Action value</span>
            <input
              required
              maxLength={500}
              value={draft.actionValue}
              onChange={(event) => setDraft({ ...draft, actionValue: event.target.value })}
              placeholder="resolved"
            />
          </label>
          <button className="primary-button" disabled={createRule.isPending} type="submit">
            {createRule.isPending ? 'Saving…' : 'Save rule'}
          </button>
        </form>
      ) : null}
      {createRule.isError ? <div className="inline-alert">{createRule.error.message}</div> : null}

      <div className="automation-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Configuration</p>
              <h2>Active rules</h2>
            </div>
            <span className="panel-meta">{rules.data.items.length} total</span>
          </div>
          <div className="rule-list">
            {rules.data.items.map((rule) => (
              <article className="rule-row" key={rule.id}>
                <div className="rule-icon">
                  <Bot size={18} />
                </div>
                <div>
                  <strong>{rule.name}</strong>
                  <span>When {humanize(rule.triggerEvent)}</span>
                  <div className="tag-list">
                    {rule.actions.map((action, index) => (
                      <span className="tag" key={`${action.type}-${index}`}>
                        {humanize(action.type)}: {action.value}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={rule.enabled ? 'enabled-label' : 'disabled-label'}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Execution</p>
              <h2>Recent runs</h2>
            </div>
          </div>
          <div className="run-list">
            {runs.data.items.length === 0 ? (
              <div className="empty-state">
                No automation runs yet. Send a terminal webhook to trigger one.
              </div>
            ) : (
              runs.data.items.map((run) => (
                <article className="run-row" key={run.id}>
                  <div>
                    <strong>{run.ruleName}</strong>
                    <span>
                      {run.providerCallId ?? 'No linked call'} · {formatDateTime(run.scheduledAt)}
                    </span>
                  </div>
                  <StatusBadge value={run.status} />
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
