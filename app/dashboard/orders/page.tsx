import Link from "next/link";
import { OrderBoard } from "@/components/order-board";
export default function OrdersPage() {
  return <><div className="px-4 pt-4 sm:px-6"><Link className="text-sm underline" href="/kitchen">เปิดหน้าครัวเพื่อจัดการสถานะรายเมนู →</Link></div><OrderBoard mode="frontdesk" /></>;
}
