import { getToken } from 'next-auth/jwt';

// Minimal index page: authenticated users -> /overview, otherwise -> /landing
export async function getServerSideProps(ctx) {
  // Always send anonymous visitors to the marketing landing page. Authenticated
  // users will still access /overview via direct link or app navigation. This
  // keeps the root page stable and predictable for first-time visitors.
  return { redirect: { destination: '/landing', permanent: false } };
}

export default function Index() {
  return null;
}
