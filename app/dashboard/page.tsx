import Dashboard from "@/components/dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const query = await searchParams;
  return <Dashboard preview={query.demo === "1"} />;
}
