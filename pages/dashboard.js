// Redirect legacy /dashboard to canonical /overview
export async function getServerSideProps() {
  return { redirect: { destination: '/overview', permanent: false } };
}

export default function DashboardRedirect() {
  return null;
}