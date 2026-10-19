import { redirect } from "next/navigation";

interface TablePageProps {
  params: Promise<{ tableNumber: string }>;
}

export default async function CustomerTableOrderingLegacyPage({ params }: TablePageProps) {
  const { tableNumber } = await params;
  
  // Forward legacy non-tenant links directly to default store route
  redirect(`/r/slow-bar/table/${tableNumber || 1}`);
}

