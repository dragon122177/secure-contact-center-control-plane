import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Database, LockKeyhole, Radio, Route, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useRouter } from '../context/RouterContext.js';

export function LoginPage() {
  const { authenticated, login } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('admin@relayops.local');
  const [password, setPassword] = useState('RelayOps!2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-mark">
            <Radio size={23} />
          </div>
          <div>
            <strong>RelayOps</strong>
            <span>Secure Contact Center Control Plane</span>
          </div>
        </div>
        <div className="story-copy">
          <p className="eyebrow">Provider-neutral operations</p>
          <h1>Control routing, access, and automation from one auditable plane.</h1>
          <p>
            A production-minded portfolio system modeled on real contact-center configuration work,
            using entirely synthetic people, calls, networks, and organizations.
          </p>
        </div>
        <div className="login-capabilities">
          <div>
            <Route size={20} />
            <span>
              <strong>Skill-aware routing</strong>Deterministic assignment with safe queue fallback.
            </span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <span>
              <strong>Provider access policy</strong>VPN and proxy metadata without transporting
              audio.
            </span>
          </div>
          <div>
            <Database size={20} />
            <span>
              <strong>Reliable event processing</strong>Idempotent inbox, transactional outbox, and
              retries.
            </span>
          </div>
        </div>
        <p className="synthetic-note">
          <LockKeyhole size={15} /> Demonstration data only. No real customer information or
          provider credentials.
        </p>
      </section>
      <section className="login-panel-wrap">
        <form className="login-panel" onSubmit={submit}>
          <div>
            <p className="eyebrow">Operations console</p>
            <h2>Sign in to RelayOps</h2>
            <p>Use the prefilled local administrator account.</p>
          </div>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <div className="inline-alert" role="alert">
              {error}
            </div>
          ) : null}
          <button className="login-button" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Open operations console'}
            <ArrowRight size={18} />
          </button>
          <div className="demo-credentials">
            <span>Local demo</span>
            <code>admin@relayops.local</code>
            <code>RelayOps!2026</code>
          </div>
        </form>
      </section>
    </main>
  );
}
