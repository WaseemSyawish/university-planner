import React from 'react';

// Simple debug page to show cookies (keeps this page harmless and SSR-friendly)
export default function CookiesDebugPage({ cookies }) {
	return (
		<div style={{ padding: 20 }}>
			<h2>Debug: Cookies</h2>
			<pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f8', padding: 12, borderRadius: 8 }}>{JSON.stringify(cookies || {}, null, 2)}</pre>
		</div>
	);
}

export async function getServerSideProps({ req }) {
	const cookies = req && req.headers ? req.headers.cookie || '' : '';
	return { props: { cookies } };
}
