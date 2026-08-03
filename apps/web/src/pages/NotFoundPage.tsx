import { useRouter } from '../context/RouterContext.js';

export function NotFoundPage() {
  const { navigate } = useRouter();
  return (
    <div className="not-found">
      <p className="eyebrow">404 / Route not found</p>
      <h1>This control-plane view does not exist.</h1>
      <a
        className="primary-button"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          navigate('/');
        }}
      >
        Return to overview
      </a>
    </div>
  );
}
