import bcrypt from 'bcryptjs';
import { loadConfig } from '../config.js';
import { Database } from '../database/client.js';

const WORKSPACE_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '20000000-0000-4000-8000-000000000001';
const SUPERVISOR_ID = '20000000-0000-4000-8000-000000000002';
const AUDITOR_ID = '20000000-0000-4000-8000-000000000003';

const teams = [
  ['30000000-0000-4000-8000-000000000001', 'customer-care', 'Customer Care'],
  ['30000000-0000-4000-8000-000000000002', 'sales', 'Sales Desk'],
  ['30000000-0000-4000-8000-000000000003', 'security', 'Security Escalations'],
] as const;

const skills = [
  ['40000000-0000-4000-8000-000000000001', 'english', 'English'],
  ['40000000-0000-4000-8000-000000000002', 'japanese', 'Japanese'],
  ['40000000-0000-4000-8000-000000000003', 'spanish', 'Spanish'],
  ['40000000-0000-4000-8000-000000000004', 'sales', 'Sales'],
  ['40000000-0000-4000-8000-000000000005', 'security', 'Security escalation'],
] as const;

type SeedAgent = {
  id: string;
  userId: string;
  teamId: string;
  externalId: string;
  name: string;
  extension: string;
  presence: string;
  skills: string[];
};

const agents: SeedAgent[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    userId: '21000000-0000-4000-8000-000000000001',
    teamId: teams[0][0],
    externalId: 'agt-aiko',
    name: 'Aiko Tanaka',
    extension: '2101',
    presence: 'AVAILABLE',
    skills: ['english', 'japanese'],
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    userId: '21000000-0000-4000-8000-000000000002',
    teamId: teams[0][0],
    externalId: 'agt-ren',
    name: 'Ren Nakamura',
    extension: '2102',
    presence: 'AVAILABLE',
    skills: ['english', 'japanese'],
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    userId: '21000000-0000-4000-8000-000000000003',
    teamId: teams[0][0],
    externalId: 'agt-sofia',
    name: 'Sofia Reyes',
    extension: '2103',
    presence: 'ON_CALL',
    skills: ['english', 'spanish'],
  },
  {
    id: '50000000-0000-4000-8000-000000000004',
    userId: '21000000-0000-4000-8000-000000000004',
    teamId: teams[0][0],
    externalId: 'agt-kenji',
    name: 'Kenji Mori',
    extension: '2104',
    presence: 'WRAP_UP',
    skills: ['japanese'],
  },
  {
    id: '50000000-0000-4000-8000-000000000005',
    userId: '21000000-0000-4000-8000-000000000005',
    teamId: teams[1][0],
    externalId: 'agt-mei',
    name: 'Mei Kobayashi',
    extension: '2201',
    presence: 'AVAILABLE',
    skills: ['english', 'japanese', 'sales'],
  },
  {
    id: '50000000-0000-4000-8000-000000000006',
    userId: '21000000-0000-4000-8000-000000000006',
    teamId: teams[1][0],
    externalId: 'agt-lucas',
    name: 'Lucas Ferreira',
    extension: '2202',
    presence: 'AVAILABLE',
    skills: ['english', 'spanish', 'sales'],
  },
  {
    id: '50000000-0000-4000-8000-000000000007',
    userId: '21000000-0000-4000-8000-000000000007',
    teamId: teams[1][0],
    externalId: 'agt-yui',
    name: 'Yui Sato',
    extension: '2203',
    presence: 'BREAK',
    skills: ['japanese', 'sales'],
  },
  {
    id: '50000000-0000-4000-8000-000000000008',
    userId: '21000000-0000-4000-8000-000000000008',
    teamId: teams[1][0],
    externalId: 'agt-noah',
    name: 'Noah Williams',
    extension: '2204',
    presence: 'OFFLINE',
    skills: ['english', 'sales'],
  },
  {
    id: '50000000-0000-4000-8000-000000000009',
    userId: '21000000-0000-4000-8000-000000000009',
    teamId: teams[2][0],
    externalId: 'agt-hana',
    name: 'Hana Ito',
    extension: '2301',
    presence: 'AVAILABLE',
    skills: ['english', 'japanese', 'security'],
  },
  {
    id: '50000000-0000-4000-8000-000000000010',
    userId: '21000000-0000-4000-8000-000000000010',
    teamId: teams[2][0],
    externalId: 'agt-diego',
    name: 'Diego Vargas',
    extension: '2302',
    presence: 'ON_CALL',
    skills: ['english', 'spanish', 'security'],
  },
  {
    id: '50000000-0000-4000-8000-000000000011',
    userId: '21000000-0000-4000-8000-000000000011',
    teamId: teams[2][0],
    externalId: 'agt-riku',
    name: 'Riku Abe',
    extension: '2303',
    presence: 'AVAILABLE',
    skills: ['japanese', 'security'],
  },
  {
    id: '50000000-0000-4000-8000-000000000012',
    userId: '21000000-0000-4000-8000-000000000012',
    teamId: teams[2][0],
    externalId: 'agt-emma',
    name: 'Emma Clark',
    extension: '2304',
    presence: 'OFFLINE',
    skills: ['english', 'security'],
  },
];

const queues = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    key: 'customer-care',
    name: 'Customer Care',
    description: 'General product and account support',
    serviceLevel: 30,
    maxWait: 240,
    requiredSkills: ['english'],
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    key: 'sales-desk',
    name: 'Sales Desk',
    description: 'Inbound qualification and sales support',
    serviceLevel: 20,
    maxWait: 180,
    requiredSkills: ['sales'],
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    key: 'security-escalations',
    name: 'Security Escalations',
    description: 'Account-security and suspicious-access triage',
    serviceLevel: 15,
    maxWait: 120,
    requiredSkills: ['security'],
  },
] as const;

const config = loadConfig();
const database = new Database(config.databaseUrl);

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash('RelayOps!2026', 12);

  await database.transaction(async (client) => {
    await client.query(
      `INSERT INTO identity.workspaces (id, slug, display_name, timezone)
       VALUES ($1, 'acme-support', 'Acme Support — Synthetic Demo', 'Asia/Tokyo')
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [WORKSPACE_ID],
    );

    const systemUsers = [
      [ADMIN_ID, 'admin@relayops.local', 'Demo Administrator', 'ADMIN'],
      [SUPERVISOR_ID, 'supervisor@relayops.local', 'Demo Supervisor', 'SUPERVISOR'],
      [AUDITOR_ID, 'auditor@relayops.local', 'Demo Auditor', 'AUDITOR'],
    ] as const;

    for (const [id, email, name, role] of systemUsers) {
      await client.query(
        `INSERT INTO identity.users (id, workspace_id, email, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6::identity.user_role)
         ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, enabled = true`,
        [id, WORKSPACE_ID, email, name, passwordHash, role],
      );
    }

    for (const [id, key, name] of teams) {
      await client.query(
        `INSERT INTO routing.teams (id, workspace_id, key, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [id, WORKSPACE_ID, key, name],
      );
    }

    for (const [id, key, name] of skills) {
      await client.query(
        `INSERT INTO routing.skills (id, workspace_id, key, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [id, WORKSPACE_ID, key, name],
      );
    }

    for (const agent of agents) {
      await client.query(
        `INSERT INTO identity.users (id, workspace_id, email, display_name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'AGENT')
         ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, enabled = true`,
        [
          agent.userId,
          WORKSPACE_ID,
          `${agent.externalId}@relayops.local`,
          agent.name,
          passwordHash,
        ],
      );

      await client.query(
        `INSERT INTO routing.agents (
           id, workspace_id, user_id, team_id, external_id, display_name, extension,
           presence, active_call_count, last_assigned_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::routing.agent_presence,
           CASE WHEN $8 = 'ON_CALL' THEN 1 ELSE 0 END,
           now() - (($9 + 1) * interval '11 minutes'))
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           team_id = EXCLUDED.team_id,
           presence = EXCLUDED.presence,
           active_call_count = EXCLUDED.active_call_count`,
        [
          agent.id,
          WORKSPACE_ID,
          agent.userId,
          agent.teamId,
          agent.externalId,
          agent.name,
          agent.extension,
          agent.presence,
          agents.indexOf(agent),
        ],
      );

      for (const skillKey of agent.skills) {
        const skill = skills.find((entry) => entry[1] === skillKey);
        if (!skill) throw new Error(`Unknown seed skill: ${skillKey}`);
        await client.query(
          `INSERT INTO routing.agent_skills (agent_id, skill_id, proficiency)
           VALUES ($1, $2, 4) ON CONFLICT (agent_id, skill_id) DO NOTHING`,
          [agent.id, skill[0]],
        );
      }
    }

    for (const queue of queues) {
      await client.query(
        `INSERT INTO routing.queues (
           id, workspace_id, key, display_name, description, service_level_seconds, max_wait_seconds
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description`,
        [
          queue.id,
          WORKSPACE_ID,
          queue.key,
          queue.name,
          queue.description,
          queue.serviceLevel,
          queue.maxWait,
        ],
      );

      for (const skillKey of queue.requiredSkills) {
        const skill = skills.find((entry) => entry[1] === skillKey);
        if (!skill) throw new Error(`Unknown queue skill: ${skillKey}`);
        await client.query(
          `INSERT INTO routing.queue_skills (queue_id, skill_id, required)
           VALUES ($1, $2, true) ON CONFLICT (queue_id, skill_id) DO NOTHING`,
          [queue.id, skill[0]],
        );
      }

      const queueMembers = agents.filter((agent) =>
        queue.requiredSkills.every((required) => agent.skills.includes(required)),
      );
      for (const agent of queueMembers) {
        await client.query(
          `INSERT INTO routing.queue_members (queue_id, agent_id, priority)
           VALUES ($1, $2, 5) ON CONFLICT (queue_id, agent_id) DO NOTHING`,
          [queue.id, agent.id],
        );
      }

      await client.query(
        `INSERT INTO routing.routing_rules (
           id, workspace_id, queue_id, name, strategy, priority, configuration
         ) VALUES (
           ('70000000-0000-4000-8000-' || lpad($1::text, 12, '0'))::uuid,
           $2, $3, $4, 'SKILL_IDLE', 100, '{"idleWeight":2,"preferredSkillWeight":100}'::jsonb
         ) ON CONFLICT (id) DO NOTHING`,
        [queues.indexOf(queue) + 1, WORKSPACE_ID, queue.id, `${queue.name} skill-and-idle routing`],
      );
    }

    const automationRules = [
      {
        id: '80000000-0000-4000-8000-000000000001',
        name: 'Tag customer-abandoned calls',
        trigger: 'CALL_ABANDONED',
        conditions: [{ field: 'status', operator: 'equals', value: 'ABANDONED' }],
        actions: [
          { type: 'ADD_TAG', value: 'callback-required' },
          { type: 'NOTIFY_SUPERVISOR', value: 'Customer abandoned before answer' },
        ],
      },
      {
        id: '80000000-0000-4000-8000-000000000002',
        name: 'Close normally completed calls',
        trigger: 'CALL_ENDED',
        conditions: [{ field: 'endedReason', operator: 'equals', value: 'NORMAL_CLEARING' }],
        actions: [{ type: 'SET_DISPOSITION', value: 'resolved' }],
      },
    ];

    for (const rule of automationRules) {
      await client.query(
        `INSERT INTO automation.rules (
           id, workspace_id, name, description, trigger_event, conditions, actions, created_by
         ) VALUES ($1, $2, $3, 'Synthetic demonstration rule', $4, $5::jsonb, $6::jsonb, $7)
         ON CONFLICT (id) DO UPDATE SET conditions = EXCLUDED.conditions, actions = EXCLUDED.actions`,
        [
          rule.id,
          WORKSPACE_ID,
          rule.name,
          rule.trigger,
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.actions),
          ADMIN_ID,
        ],
      );
    }

    await client.query(
      `INSERT INTO security.network_policies (
         id, workspace_id, name, provider_name, access_type, allowed_cidrs,
         require_managed_device, notes
       ) VALUES (
         '90000000-0000-4000-8000-000000000001', $1,
         'Provider VPN — Operations', 'FictionalTel Provider', 'VPN',
         ARRAY['10.44.0.0/16'::cidr, '198.51.100.0/24'::cidr], true,
         'Documentation-only ranges. Provider-hosted VPN; RelayOps stores policy metadata.'
       ) ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes`,
      [WORKSPACE_ID],
    );

    const sampleCalls = [
      [
        'a0000000-0000-4000-8000-000000000001',
        'demo-active-001',
        queues[0].id,
        agents[2]!.id,
        'ACTIVE',
        8,
        null,
      ],
      [
        'a0000000-0000-4000-8000-000000000002',
        'demo-active-002',
        queues[2].id,
        agents[9]!.id,
        'ACTIVE',
        14,
        null,
      ],
      [
        'a0000000-0000-4000-8000-000000000003',
        'demo-waiting-001',
        queues[1].id,
        null,
        'QUEUED',
        2,
        null,
      ],
      [
        'a0000000-0000-4000-8000-000000000004',
        'demo-complete-001',
        queues[0].id,
        agents[0]!.id,
        'COMPLETED',
        67,
        'NORMAL_CLEARING',
      ],
      [
        'a0000000-0000-4000-8000-000000000005',
        'demo-complete-002',
        queues[1].id,
        agents[4]!.id,
        'COMPLETED',
        125,
        'NORMAL_CLEARING',
      ],
      [
        'a0000000-0000-4000-8000-000000000006',
        'demo-abandoned-001',
        queues[0].id,
        null,
        'ABANDONED',
        42,
        'CALLER_HANGUP',
      ],
    ] as const;

    for (const [id, providerId, queueId, agentId, status, minutesAgo, endedReason] of sampleCalls) {
      await client.query(
        `INSERT INTO calls.call_sessions (
           id, workspace_id, provider_call_id, queue_id, assigned_agent_id, direction,
           status, caller_number, destination_number, started_at, answered_at, ended_at, ended_reason
         ) VALUES (
           $1, $2, $3, $4, $5, 'INBOUND', $6::calls.call_status,
           '+81-50-0000-' || right($3, 3), '+81-50-5555-0100',
           now() - ($7 * interval '1 minute'),
           CASE WHEN $6 IN ('ACTIVE', 'COMPLETED') THEN now() - (($7 - 1) * interval '1 minute') ELSE NULL END,
           CASE WHEN $6 IN ('COMPLETED', 'ABANDONED', 'FAILED') THEN now() - (($7 - 3) * interval '1 minute') ELSE NULL END,
           $8
         ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, ended_reason = EXCLUDED.ended_reason`,
        [id, WORKSPACE_ID, providerId, queueId, agentId, status, minutesAgo, endedReason],
      );
    }

    await client.query(
      `INSERT INTO audit.audit_events (
         id, workspace_id, actor_user_id, actor_email, action, resource_type,
         resource_id, correlation_id, source_ip, after_state
       ) VALUES (
         'b0000000-0000-4000-8000-000000000001', $1::uuid, $2, 'admin@relayops.local',
         'DEMO_DATA_SEEDED', 'workspace', ($1::uuid)::text,
         'b1000000-0000-4000-8000-000000000001', '127.0.0.1',
         '{"synthetic":true,"agentCount":12}'::jsonb
       ) ON CONFLICT (id) DO NOTHING`,
      [WORKSPACE_ID, ADMIN_ID],
    );
  });
}

try {
  await seed();
  console.log('Seeded one synthetic workspace, 12 agents, queues, calls, policies, and rules.');
  console.log('Demo login: admin@relayops.local / RelayOps!2026');
} finally {
  await database.close();
}
