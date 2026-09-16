import { redirect } from "next/navigation";

export default async function CustomerStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { storeSlug } = await params;
  const { table } = await searchParams;

  if (table) {
    redirect(`/r/${storeSlug}/table/${table}`);
  }

  // If no table is provided, default to table 1
  redirect(`/r/${storeSlug}/table/1`);
}
