import Link from "next/link";

export default function AccessDeniedPage() {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6">
    <h1 className="text-2xl font-bold">ยังเข้าใช้งานหน้านี้ไม่ได้</h1>
    <p className="text-muted-foreground">กรุณาตรวจว่าล็อกอินด้วยอีเมลที่เจ้าของร้านเพิ่มไว้ หากมีรายชื่อซ้ำหรือบทบาทเดิม ให้เจ้าของร้านแก้ไขในหน้าจัดการพนักงาน</p>
    <Link href="/workspace" className="underline">กลับหน้าทำงานของฉัน</Link>
    <form action="/auth/signout" method="post"><button className="min-h-11 rounded-lg border px-4" type="submit">ออกจากระบบเพื่อเปลี่ยนบัญชี</button></form>
  </main>;
}
