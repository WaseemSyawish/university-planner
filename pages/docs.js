import Link from 'next/link';
export default function Docs() {
  return (
    <div style={{ padding: 36 }}>
      <div className="card" style={{ maxWidth: 800, margin: '48px auto' }}>
        <h2>Documentation</h2>
        <p className="muted">Documentation placeholder — add guides and API docs here.</p>
  <p style={{ marginTop: 12 }}><Link href="/landing">Return to landing</Link></p>
      </div>
    </div>
  );
}
