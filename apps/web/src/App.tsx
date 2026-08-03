import { Layout } from './components/Layout.js';
import { useAuth } from './context/AuthContext.js';
import { useRouter } from './context/RouterContext.js';
import { AgentsPage } from './pages/AgentsPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { AutomationsPage } from './pages/AutomationsPage.js';
import { CallsPage } from './pages/CallsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { NetworkPage } from './pages/NetworkPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { QueuesPage } from './pages/QueuesPage.js';

const protectedPages: Record<string, () => React.JSX.Element> = {
  '/': OverviewPage,
  '/agents': AgentsPage,
  '/queues': QueuesPage,
  '/calls': CallsPage,
  '/automations': AutomationsPage,
  '/network': NetworkPage,
  '/audit': AuditPage,
};

export function App() {
  const { authenticated } = useAuth();
  const { path } = useRouter();

  if (!authenticated || path === '/login') return <LoginPage />;
  const Page = protectedPages[path];

  return <Layout>{Page ? <Page /> : <NotFoundPage />}</Layout>;
}
