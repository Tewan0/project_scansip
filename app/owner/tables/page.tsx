import DashboardLayout from "@/app/dashboard/layout";
import QrCodeGeneratorPage from "@/app/dashboard/qr-code/page";

export default function OwnerTablesPage() {
  return (
    <DashboardLayout>
      <QrCodeGeneratorPage />
    </DashboardLayout>
  );
}
