# ตรวจซ้ำหลัง deploy — 26 ตุลาคม 2026

## ข้อสรุป

ไม่พบช่องโหว่ใหม่ที่ยืนยันได้ว่าใช้ข้ามสิทธิ์ อ่านข้อมูลข้ามร้าน หรือปลอมการรับเงินในขอบเขตที่ตรวจ การแก้ slug/รหัสร้านและ POST-only signout อยู่ใน commit ล่าสุดแล้ว

พบข้อควรแก้ด้านการใช้งาน/ความเรียบร้อย 2 เรื่อง: เพดานขนาดอัปโหลดไม่ตรงกับ transport และไฟล์ใหม่ค้างเมื่อแก้ไขเมนูแล้วฐานข้อมูลบันทึกไม่สำเร็จ ทั้งสองเรื่องไม่ใช่หลักฐานว่าผู้อื่นยึดบัญชีหรืออ่านข้อมูลร้านได้

ไม่มีเหตุผลจากการตรวจนี้ที่ต้องเพิ่มฟีเจอร์ใหญ่หรือรื้อ UI ใหม่ การตรวจไม่ใช่การรับรองว่าไม่มีช่องโหว่ทั้งหมด

## เวอร์ชันและผลตรวจ

- Local HEAD และ GitHub main ตรงกัน: 393a37bb3585227a0f807613ffe1199fa84d5ef2 — ปรับปรุงระบบออกจากระบบและตรวจสอบร้านค้า
- Local git tree: 0b99c9c5658184df3de88d1361d1a1e7909280b8; working tree สะอาดก่อนตรวจ
- [Commit](https://github.com/Tewan0/project_scansip/commit/393a37bb3585227a0f807613ffe1199fa84d5ef2)
- [Vercel status: success](https://vercel.com/tewan0s-projects/project-scansip/4jDRJiYN7kGLgD3pFSPV2S3QGevt)
- node --test tests/*.test.mjs: 317 ผ่าน / 0 ล้มเหลว
- ESLint ทั้งโปรเจกต์ --max-warnings=0: ผ่าน ไม่มีคำเตือนจาก lint
- TypeScript tsc --noEmit: ผ่าน
- npm audit รวม dev dependencies: 0 ช่องโหว่ ณ เวลาที่ตรวจ; dependency ทั้งหมด 772 ตามผล audit
- npm แจ้ง Unknown env config http-proxy จากสภาพแวดล้อมเครื่องมือ เป็นคนละเรื่องกับ lint/dependency vulnerabilities
- สแกนไฟล์ tracked 265 ไฟล์ด้วย pattern Google API key, private key, Supabase secret/service_role JWT และ GitHub token ไม่พบ match; tracked env มีเฉพาะ .env.example และ git log ของ .env/.env.local ใน refs ที่มีในเครื่องไม่พบ commit
- ไม่ใช่ secret scan ครบทุกชนิดหรือทุก blob ในประวัติ Git และไม่ได้อ่านค่าคีย์จริงใน environment
- รอบนี้เพิ่มรายงานเท่านั้น ไม่แก้ application code ไม่ push ไม่ deploy และไม่เปลี่ยนข้อมูล production

## 1. ควรแก้ก่อน — ขนาดอัปโหลดที่แอปยอมรับไม่ตรงกับข้อจำกัดขนส่ง

ประเภท: ความถูกต้องในการใช้งาน ระดับปานกลาง (P2)

หลักฐานใน repository:

- lib/request-body.ts บรรทัด 11–12 อนุญาตไฟล์ 5 MiB และ multipart body เพิ่มอีก 64 KiB
- app/dashboard/settings/page.tsx แสดงและตรวจรับรูปสูงสุด 5 MB
- app/dashboard/menu/EditMenuItemModal.tsx บรรทัด 128 ส่ง FormData รวมรูปเข้า updateMenuItem ซึ่งเป็น Server Action
- next.config.ts ไม่ได้ตั้ง experimental.serverActions.bodySizeLimit
- เอกสารและ implementation ของ Next.js ที่ติดตั้งระบุ defaultBodySizeLimit = 1 MB; นับ bytes ทั้ง HTTP body และตอบ 413 ก่อนเรียก action เมื่อเกิน
- ข้อจำกัด Vercel Functions ปัจจุบันคือ request body สูงสุด 4.5 MB รวม multipart overhead

ผลที่ตามมาจากโค้ด/ข้อจำกัดเหล่านี้:

- การแก้รูปเมนูขนาดเกินประมาณ 1 MB จะชนเพดาน Server Action แม้ validateImageUpload ยอมรับไฟล์นั้น
- การอัปโหลดผ่าน /api/upload หรือ /api/menu ใกล้ 5 MB ชนเพดาน Vercel ก่อนถึงตัวตรวจไฟล์ของแอป
- Tests ที่เรียก handler/action โดยตรงไม่ได้ผ่านชั้น HTTP transport จึงยังผ่านแม้มีปัญหานี้
- ช่องแก้รูปเมนูตรวจเพียง MIME ขึ้นต้น image/ ฝั่ง UI ไม่มี size precheck จึงแจ้งปัญหาหลังส่งข้อมูล และเลือกบาง format ที่ server ไม่รับได้ เป็น UX ที่ควรปรับในงานเดียวกัน

แนวทางสำหรับคาเฟ่ขนาดเล็ก:

- ใช้ขีดจำกัดเดียวกันที่ UI/server เช่น 4 MiB ต่อไฟล์ และเผื่อ multipart overhead ให้ยังต่ำกว่าเพดาน Vercel
- ตั้ง Server Action bodySizeLimit ให้พอสำหรับไฟล์และ overhead หรือเปลี่ยนเส้นทางแก้รูปให้ใช้งาน upload API ที่ตรวจไฟล์อยู่แล้ว
- ใช้ MIME whitelist เดียวกันและแจ้งข้อจำกัดก่อนส่ง
- ทดสอบผ่าน transport จริงด้วยรูปเล็ก, มากกว่า 1 MB, ใกล้เพดาน และเกินเพดานหลังแก้
- ไม่จำเป็นต้องเพิ่มระบบ direct upload ใหม่สำหรับความต้องการปัจจุบัน; หากเลือกใช้ในอนาคต ต้องคงการตรวจสิทธิ์/ไฟล์และ quota เดิม

นี่เป็นข้อสรุปจาก source และข้อจำกัดที่ยืนยันกับเอกสาร ไม่ได้อัปโหลดไฟล์จริงไป production เพื่อสร้าง error ในรอบนี้

แหล่งอ้างอิง:
- [Next.js serverActions bodySizeLimit](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

## 2. ควรเก็บงาน — ไฟล์ใหม่ค้างเมื่อแก้เมนูแล้ว DB บันทึกไม่สำเร็จ

ประเภท: การใช้พื้นที่ Storage/การกู้คืนเมื่อบันทึกล้มเหลว ระดับต่ำ (P3)

ตำแหน่ง: app/actions/menu.ts ใน updateMenuItem

- อัปโหลดรูปใหม่ที่บรรทัด 46 แล้วบันทึก DB ที่บรรทัด 50
- ถ้า DB throw จะออกไป catch ทันที ไม่มีการลบไฟล์ใหม่ที่เพิ่งอัปโหลด
- เส้นทางสร้างเมนู app/api/menu/route.ts มี cleanup เมื่อ insert ล้มเหลวอยู่แล้ว แต่เส้นทางแก้เมนูยังไม่มี

จำลอง offline ด้วย action จริง, ภาพ PNG ที่ sharp ถอดรหัสได้ และ mock DB/Storage:

1. เตรียมเมนูของ owner โดยไม่มีรูปเดิม
2. Storage upload คืน success
3. บังคับ db.update throw เพื่อจำลองการบันทึกล้มเหลว
4. ผล: success=false, status=500, uploads=1, remove=0 และ imageUrl ใน DB ยังคง null

ไม่ได้พิสูจน์ว่ามีไฟล์ค้างจริงใน production และไม่ได้ลบไฟล์จริง ผลกระทบคือ retry หลายครั้งอาจสะสมไฟล์ที่ไม่ได้อ้างอิงและใช้พื้นที่เกินจำเป็น

แนวทาง: เก็บ path ของไฟล์ที่เพิ่งอัปโหลดและจัดการ cleanup เมื่อยืนยันว่าไม่ได้ถูกบันทึกใช้งาน โดยไม่ลบรูปเดิม; หากสถานะ commit ไม่แน่ชัดจาก connection failure ควรตรวจการอ้างอิงก่อนลบ ไม่ควรลบไฟล์เก่าทั้ง bucket อัตโนมัติ

## สิ่งที่ควรเพิ่มแบบไม่เร่งด่วน

1. GitHub CI: repository ยังไม่มี .github/workflows ให้รัน tests, TypeScript และ lint ตอน push/PR; Vercel build success ไม่ทดแทนชุดทดสอบทั้งหมด
2. Storage bucket constraints: restaurant-logos และ menu-photos ยังมี file_size_limit=null และ allowed_mime_types=null ทั้งคู่ ควรตั้งให้ตรงกับเพดานใหม่หลังแก้ข้อ 1 และชนิดภาพที่แอปรองรับ เป็นการเสริมอีกชั้น; รอบนี้ไม่พบ public write policy

## สิ่งที่พิจารณาเอาออกได้

- utils/store.ts: generateSlug, getCurrentUserId และ getOrCreateStore
- app/actions/owner-auth.ts: signOutOwner

ค้นชื่อใน tracked TS/TSX/MJS รวม tests พบเฉพาะ definition ไม่มี caller ปัจจุบัน การลบเป็นงานลดโค้ดเก่า ไม่ใช่การปิดช่องโหว่ที่พิสูจน์ได้ ควรแยกจากการแก้พฤติกรรมและตรวจ build/tests หลังลบ

Storage มี SELECT policy ของ menu-photos ที่เงื่อนไขซ้ำกัน 2 ตัว: Allow public read menu-photos และ Anyone can view menu photos สามารถลดเหลืออันเดียวโดยตรวจการใช้งานก่อน การลบเฉพาะตัวซ้ำไม่ได้ทำให้ public image กลายเป็น private และไม่ได้แก้สิทธิ์ list metadata ที่เหลืออยู่

ไม่แนะนำให้ลบ index เพียงเพราะมีคำเตือน unused_index และไม่ควรลบ migrations/tests หรือ legacy URL โดยไม่ตรวจว่ามีผู้ใช้/ลิงก์เก่าอ้างถึง

## ขอบเขตความปลอดภัยที่ตรวจซ้ำ

| ส่วน | ผลตรวจในขอบเขตนี้ |
| --- | --- |
| Auth/บทบาท | getUser ตรวจผู้ใช้จริง อ่าน role จาก DB ทุกคำขอ; ไม่ใช้ user_metadata ตัดสินสิทธิ์ |
| คำเชิญ/สร้างร้าน | email ยืนยันแล้ว, ยอมรับคำเชิญชัดเจน, account lock และตรวจสถานะซ้ำ |
| การแยกร้าน | mutation ตรวจ store/role; internal order.storeId ใช้ lookup ID เฉพาะหลังแก้ |
| Slug | ห้าม UUID ที่ onboarding/settings/availability; production UUID-shaped slugs=0 |
| Logout | POST + Origin/Fetch Metadata checks; GET/HEAD ไม่เรียก signOut; regression tests ผ่าน |
| QR/โต๊ะ | ตรวจ token/หมดอายุ/รอบ, lock และ expectedSessionToken ตอนปิดโต๊ะ |
| สั่งอาหาร | ราคา authoritative จาก DB, จำกัดรายการ/จำนวน, idempotency และ persistent quota |
| รับเงิน | ตรวจ snapshot ยอด/รายการ, ล็อก store/table/orders, ไม่รับซ้ำและไม่อนุญาตครัวรับเงิน |
| รูปภาพ | สิทธิ์เจ้าของ path, quota, byte/pixel/frame limit และ decode ภาพจริงก่อนเก็บ |
| Chatbot | server key, bounded body, 20-second provider timeout, quota, ตรวจคำตอบ/ID เมนูและ QR ซ้ำ; ไม่มีเครื่องมือแก้ออเดอร์หรือรับเงิน |
| XSS/SQL | ไม่พบ user-controlled raw HTML หรือ SQL raw ในจุดที่ค้น; dangerouslySetInnerHTML ที่พบใช้ theme script คงที่ |
| รายงาน | จำกัด owner และ store; ช่วงวันกรุงเทพฯ; ประวัติบิลยังอ่าน metadata ของร้านก่อนแบ่งหน้า ควรติดตามเมื่อข้อมูลมากขึ้น แต่ยังไม่ได้วัดว่าช้า |

## Supabase production แบบอ่านอย่างเดียว

- public tables 10 ตารางเปิด RLS
- anon/authenticated ไม่มี CRUD ระดับตารางและไม่มี SELECT/INSERT/UPDATE ระดับคอลัมน์ของ 10 ตารางนี้
- public SECURITY DEFINER ที่ตรวจพบคือ rls_auto_enable; anon/authenticated ไม่มี EXECUTE
- Storage objects มีเฉพาะ public SELECT ในผล policies ไม่มี public INSERT/UPDATE/DELETE
- Security advisors: INFO rls_enabled_no_policy 10 รายการ สอดคล้องกับ backend-only; ไม่ควรเปิด policy กว้างเพียงเพื่อล้างข้อความ
- WARN leaked password protection disabled 1 รายการ: UI ใช้ Google OAuth แต่ยังไม่ได้ตรวจ Auth provider settings ทั้งหมด หากเปิด email/password อยู่ควรทบทวนคำเตือนนี้
- Performance advisors: INFO unused_index 8 รายการเดิม รวม index รองรับ foreign key; ไม่แนะนำลบทันที

## ข้อจำกัด

- เครื่องมือ web เข้าถึง homepage และ owner/login ของ production ไม่ได้ในรอบนี้; ไม่ถือว่าผล HTTP/browser test ผ่าน และไม่ได้สรุปว่าเว็บไซต์ล่ม
- ไม่ได้รันวิธี HTTP smoke เดิมที่เคยถูก automatic approval review ปฏิเสธจากการเชื่อมต่อ telemetry นอกขอบเขต
- ยืนยัน deploy success จาก GitHub/Vercel status ได้ แต่ยังไม่ได้ทดสอบ Google login, logout cookie จริง, สั่งอาหาร/รับเงิน/อัปโหลดผ่านเบราว์เซอร์บน deployment ล่าสุด
- ไม่ได้เรียก Gemini จริง, load test, ทดสอบกู้คืน backup หรือสแกน Git history ทุก blob
- ไม่มีการเขียน/ลบ production data เพื่อพิสูจน์ข้อสงสัย; กรณี failure ใช้ fixtures ในเครื่องทั้งหมด
- จึงไม่รับรองว่าไม่มีช่องโหว่ทั้งหมด แม้ tests และ dependency audit ผ่าน

## สถานะการแก้ไขหลังรายงาน

แก้สองประเด็นหลักใน working tree แล้ว ยังไม่ได้ push/deploy:

1. ใช้เพดานรูป 4 MiB และ multipart 4 MiB + 64 KiB ร่วมกันใน UI/server/Next config ผ่าน lib/image-upload.ts; เพิ่มการปฏิเสธไฟล์ว่าง/MIME ไม่รองรับ/ขนาดเกินก่อนส่งครบทั้ง 4 หน้าจอ และเพิ่มข้อความบอกขนาด
2. เก็บ path รูปใหม่ที่อัปโหลดสำเร็จ เมื่อบันทึกเมนูล้มเหลวจะตรวจการอ้างอิงในเมนูของร้านก่อนลบไฟล์ใหม่นั้น ถ้า commit สำเร็จแล้วหรือ verification ล้มเหลวจะไม่ลบ และไม่ลบรูปเก่าในเส้นทางบันทึกล้มเหลว

เพิ่ม 14 tests ใน tests/image-upload-ui.test.mjs และ tests/menu-upload-cleanup.test.mjs รวมทั้งหมด 331/331 ผ่าน; TypeScript และ ESLint --max-warnings=0 ผ่าน การทดสอบ boundary เดิมปรับเป็น 4 MiB แล้ว

HTTP transport probe ถูก automatic approval review ปฏิเสธ โดยระบุการเชื่อมต่อ telemetry ภายนอกที่ไม่ทราบ payload แม้ตั้ง NEXT_TELEMETRY_DISABLED=1; ไม่อ้างว่าการทดสอบ HTTP ผ่านและไม่ลองวิธีเดิมซ้ำ การยืนยันรอบนี้เป็นการทดสอบ handlers, components และ config ในเครื่อง การทดสอบ upload ผ่านเบราว์เซอร์หลัง deploy ยังจำเป็น

งานเสริม CI, bucket constraints และการนำโค้ด/policy ที่ซ้ำออกยังไม่ได้ทำในขั้นนี้
