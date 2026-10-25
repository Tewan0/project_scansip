# เก็บคำเตือนความปลอดภัยและฐานข้อมูล

ตรวจและปรับปรุงวันที่ 25 ตุลาคม 2026 ต่อจาก commit f6993ee

## แพ็กเกจ

- body-parser: 2.3.0 → 2.4.0
- fast-uri: 3.1.8 → 3.1.9
- zod: 4.5.4 → 4.6.7
- drizzle-kit: 0.31.10 → 0.31.11
- กำหนด override เฉพาะ esbuild ใต้ @esbuild-kit/core-utils เป็น 0.25.12 เพื่อเลิกใช้ 0.18.20 โดยยังใช้ Drizzle Kit รุ่นปัจจุบัน
- เก็บ package-lock.json ที่ npm resolve แล้ว รวมแพ็กเกจสำหรับระบบปฏิบัติการอื่น; npm ls ตรวจ dependency tree ผ่าน
- ไม่ใช้ npm audit fix --force ซึ่งเสนอให้ลด Drizzle Kit กลับไป 0.18.1
- npm audit ทั้ง production และ dev dependencies: 0 รายการ ณ เวลาที่ตรวจ ไม่ใช่การรับรองว่าไม่มีช่องโหว่ทุกชนิด
- ทดสอบตัวแปลง TypeScript ของ @esbuild-kit/core-utils ทั้ง CommonJS แบบ sync และ ESM แบบ async ผ่าน; Drizzle generate อ่าน schema ได้และไม่พบ schema diff หลังสร้าง migration
- เมื่อต้นทางเลิกใช้ @esbuild-kit/esm-loader แล้ว ให้ทบทวนและนำ override ออกพร้อมรัน audit และทดสอบใหม่

## สิทธิ์ฐานข้อมูล

Migration 0012_restrict_rls_event_trigger ถอน EXECUTE ของ public.rls_auto_enable() จาก PUBLIC, anon และ authenticated แล้วใน Supabase

- คง function body, SECURITY DEFINER, search_path และ event trigger เดิม
- เจ้าของฟังก์ชันยังมีสิทธิ์ และตรวจด้วยการสร้างตาราง probe แล้ว rollback ว่าระบบเปิด RLS อัตโนมัติยังทำงาน
- คำเตือน anon/authenticated SECURITY DEFINER สองรายการหายแล้ว
- migration ข้ามได้หากฐานข้อมูลใหม่ไม่มีฟังก์ชันนี้ ไม่สร้างฟังก์ชันเฉพาะ Supabase ขึ้นเอง

## Index

Migration 0013_foreign_key_indexes เพิ่ม index ต่อไปนี้ใน schema ของ Drizzle และ Supabase แล้ว:

| ตาราง | คอลัมน์ | งานที่รองรับ |
| --- | --- | --- |
| categories | store_id | รายการหมวดหมู่ของร้าน และ foreign key |
| menu_items | store_id | เมนูของร้าน และ foreign key |
| menu_items | category_id | เมนูตามหมวด และการลบหมวดแบบ SET NULL |
| order_items | order_id | รายการอาหารของออเดอร์/บิล และ foreign key |
| order_items | menu_item_id | การจัดการรายการอ้างอิงเมนูเมื่อเมนูถูกลบ |
| orders | table_id | ออเดอร์ที่อ้างอิงโต๊ะ และ foreign key |
| staff | store_id | รายชื่อพนักงานของร้าน และ foreign key |

ตารางตอนตรวจมีขนาดเล็ก (ตารางละ 8 KiB) ใช้ CREATE INDEX ปกติ พร้อมจำกัด lock timeout 3 วินาทีและ statement timeout 30 วินาที ไม่มีการแก้แถวข้อมูลร้าน หากนำ migration ไปใช้กับฐานข้อมูลขนาดใหญ่ ควรวางแผนสร้าง index แบบ concurrent แทน

ตรวจว่า index ทั้ง 7 ตัว valid/ready และ EXPLAIN สามารถใช้ order_items_order_id_idx ได้ โดยปิด sequential scan เฉพาะ transaction ทดสอบ นี่เป็นการตรวจว่าใช้ index ได้ ไม่ใช่ผลวัดความเร็วจริง

## คำเตือนที่คงไว้

- RLS Enabled No Policy จำนวน 10 ตาราง: ตั้งใจให้เข้าผ่าน backend ตรวจแล้วว่า RLS เปิดและ anon/authenticated ไม่มีสิทธิ์ CRUD โดยตรง ไม่เพิ่ม policy เพื่อทำให้คำเตือนหาย
- Leaked Password Protection Disabled: หน้าเข้าสู่ระบบใช้ Google OAuth; ไม่ปรับแพ็กเกจ Supabase หรือวิธีเข้าสู่ระบบเพื่อแก้ข้อความเตือนนี้ ควรทบทวนใหม่หากเพิ่มการเข้าสู่ระบบด้วยรหัสผ่าน (ยังไม่ได้ตรวจการตั้งค่า Auth provider ทั้งหมดบน Dashboard)
- Unused Index จำนวน 8 รายการ: รวม index ใหม่ 7 ตัวและ orders_payment_id_idx เดิม เก็บไว้เพื่อรองรับ foreign key; สถิติยังไม่ถูกใช้งานเพียงอย่างเดียวไม่ใช่เหตุผลพอให้ลบ
- npm แจ้ง Unknown env config http-proxy จากสภาพแวดล้อมเครื่องมือ ไม่ใช่คำเตือนจากโค้ดเว็บ และไม่ได้เปลี่ยน proxy ของเครื่อง

## การตรวจสอบ

- Automated tests 242 ข้อผ่าน และ ESLint ทั้งโปรเจกต์ผ่านด้วย --max-warnings=0
- Build ล่าสุดคอมไพล์และตรวจ TypeScript ผ่าน แต่ prerender ล้มเหลวด้วย EPERM ตอน mkdir ใต้ .next; ทดลอง output ใหม่ใต้ build/ ก็พบข้อจำกัดเดียวกัน จึงยังยืนยัน production build ล่าสุดว่าสำเร็จไม่ได้ คืนค่า next.config.ts, tsconfig.json และ next-env.d.ts เดิมแล้ว ต้องตรวจ build บน Vercel หรือเครื่องที่ไม่ติดข้อจำกัดนี้
- shadcn CLI --version และ git diff --check ผ่าน
- SQL ใน tests/database-hardening.sql ผ่านบน Supabase: สิทธิ์ฟังก์ชัน, auto-RLS, การป้องกันตาราง 10 ตาราง และ index ทั้ง 7; probe ถูก rollback แล้ว
- ยังไม่ได้ทดสอบผ่านเบราว์เซอร์จริงหรือยืนยัน deployment บน Vercel
- Migration 0012 และ 0013 ใช้กับ Supabase แล้ว ไม่ต้องนำไปรันซ้ำด้วยมือ; โค้ดรอบนี้ยังไม่ได้ commit/push/deploy

## อ้างอิง

- [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [Supabase function permissions](https://supabase.com/docs/guides/api/securing-your-api)
- [RLS ไม่มี policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
