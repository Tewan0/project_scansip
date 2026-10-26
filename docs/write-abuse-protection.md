# การจำกัดออเดอร์และอัปโหลด

เพิ่มเมื่อ 24 ตุลาคม 2026 สำหรับ POST /api/orders และ POST /api/upload; ขยายโควตาอัปโหลดเดียวกันไปยัง POST /api/menu และ updateMenuItem ใน app/actions/menu.ts แล้ว

| รายการ | ขอบเขต | เพดาน |
| --- | --- | --- |
| ออเดอร์ใหม่ | ต่อโต๊ะ | 6 ครั้ง / 60 วินาที และ 60 ครั้ง / 60 นาที |
| อัปโหลดของเจ้าของร้าน | ต่อบัญชี รวมทั้งสอง bucket | 10 ครั้ง / 60 วินาที และ 100 ครั้ง / 24 ชั่วโมง |
| อัปโหลดก่อนสร้างร้าน | ต่อบัญชี เฉพาะโลโก้ | 3 ครั้ง / 60 วินาที และ 10 ครั้ง / 24 ชั่วโมง |

ช่วงเวลานับจากคำขอแรกของแต่ละช่วง ไม่ใช่ตามนาฬิกาหรือวันปฏิทิน ตั้งค่าใน lib/write-rate-limit.ts

## พฤติกรรม

- เก็บตัวนับในตารางเดิม chat_rate_limits โดยแยก ID ด้วย write: จึงไม่ชนโควตา AI และไม่ต้องเพิ่ม schema หรือตัวแปรแวดล้อม
- ใช้ transaction advisory lock ต่อขอบเขตก่อนอ่าน/สร้างตัวนับ รวมถึงกรณียังไม่มีแถว เพื่อให้คำขอจากหลาย instance ใช้เพดานเดียวกัน มีเพียงสองแถวต่อบัญชีหรือโต๊ะ ไม่เพิ่มแถวใหม่ทุกช่วงเวลา
- ออเดอร์ตรวจ QR และเมนูก่อนตัดโควตา ตัวนับและออเดอร์อยู่ใน transaction เดียวกัน หากบันทึกไม่สำเร็จจะ rollback ทั้งคู่ การคืนออเดอร์เดิมด้วย requestId เดิมเกิดก่อนตรวจโควตาและไม่เพิ่มตัวนับ
- การเปลี่ยน QR หรือปลอม IP ไม่รีเซ็ตโควตาของโต๊ะ โต๊ะอื่นและร้านอื่นใช้โควตาแยกกัน
- POST /api/upload ตรวจบัญชีและสิทธิ์ก่อนอ่านไฟล์ จากนั้นจองโควตาให้สำเร็จก่อนอ่าน multipart และเรียก Storage คำขอผิดรูปแบบหรือ Storage ล้มเหลวยังคงนับ เพื่อไม่ให้ส่งซ้ำได้ไม่จำกัด
- หน้าเพิ่มเมนูตรวจสิทธิ์และอ่าน multipart แบบจำกัดขนาดก่อนตรวจข้อมูลเมนู เมื่อมีรูปจึงจองโควตาผ่าน lib/upload-policy.ts ก่อนตรวจไฟล์และเรียก Storage; การแก้เมนูตรวจสิทธิ์และร้านของเมนูก่อนใช้ helper เดียวกัน การทำรายการที่ไม่แนบรูปไม่ใช้โควตา
- การตรวจข้อมูลเมนูไม่ผ่าน หรือข้อมูลรวมเกินเพดานก่อนถึงขั้นอัปโหลด จะไม่ตัดโควตา เมื่อจองโควตาแล้ว ไฟล์ชนิด/ขนาดไม่ถูกต้อง การอัปโหลดล้มเหลว หรือบันทึกเมนูล้มเหลวจะไม่คืนจำนวนครั้ง
- บัญชีที่สร้างร้านแล้วใช้ตัวนับเดิม แต่ได้เพดานของเจ้าของร้าน การเปลี่ยน bucket ไม่รีเซ็ตโควตา หากฐานข้อมูลโควตาขัดข้องจะไม่เริ่มอัปโหลด
- เมื่อครบเพดาน API ตอบ 429 พร้อม Retry-After และ retryAfter หน่วยวินาที รวมถึงข้อความภาษาไทย หน้าลูกค้าเก็บตะกร้าและ requestId เดิมไว้ให้กดลองใหม่เอง ไม่ส่งซ้ำอัตโนมัติและไม่ถือว่า QR หมดอายุ

## ขนาดคำขอ

lib/request-body.ts ตรวจทั้ง Content-Type, Content-Length และจำนวนไบต์จริงระหว่างอ่าน stream จึงป้องกันการละหรือปลอม Content-Length ได้

- JSON ออเดอร์ไม่เกิน 80 KiB รองรับ 50 รายการและหมายเหตุภาษาไทยตามขีดจำกัดเดิม
- JSON เพิ่มเมนูไม่เกิน 64 KiB; multipart เพิ่มเมนูใช้เพดานเดียวกับ API อัปโหลด
- Server Action ตรวจขนาด field หลัง parse และตั้ง experimental.serverActions.bodySizeLimit เป็น 4 MiB + 64 KiB จาก lib/image-upload.ts ใช้เพดานร่วมกับ multipart API และต่ำกว่าเพดาน Vercel 4.5 MB
- multipart อัปโหลดรวมทุก field ไม่เกิน 4 MiB + 64 KiB โดยไฟล์ไม่เกิน 4 MiB
- เกินขนาดตอบ 413 ก่อน parse ข้อมูลทั้งหมดหรือเรียก Storage ส่วนไฟล์ที่เกิน 4 MiB แต่ multipart ยังอยู่ในเพดานตอบ 400 ตามการตรวจไฟล์เดิม
- แพลตฟอร์มโฮสต์อาจมีขีดจำกัดต่ำกว่าและปฏิเสธคำขอก่อนถึงแอป

## การตรวจสอบ

- tests/write-abuse.test.mjs ครอบคลุมเพดานช่วงสั้น/ยาว การรีเซ็ตช่วงเวลา การแยกบัญชี/ร้าน/โต๊ะ การคืนออเดอร์เดิม การ rollback และคำขอที่ปลอมขนาด
- tests/customer-cart.test.mjs ตรวจว่าตะกร้าและ requestId ยังอยู่หลัง 429 และกดลองใหม่ได้
- node tests/write-rate-limit.sql.mjs สร้าง SQL จาก helper และ Drizzle จริง พร้อม assertion ใช้รันใน PostgreSQL เพื่อทดสอบบนตารางชั่วคราวที่บังตารางจริง และ rollback เมื่อจบ ห้ามตัด guard หรือเปลี่ยนเป้าหมายไปเป็น public.chat_rate_limits
- ตรวจ SQL ดังกล่าวกับ Supabase แล้วผ่าน โดยไม่มีการเขียนข้อมูลแอปจริง การตรวจนี้ยืนยัน SQL และการเพิ่ม/เปลี่ยนช่วงของตัวนับ ไม่ใช่การทดสอบโหลดหลายเครื่องพร้อมกัน
- ตรวจฐานข้อมูลแล้ว chat_rate_limits เปิด RLS และไม่มีสิทธิ์ของ anon/authenticated; Storage ไม่มี policy ให้ไคลเอนต์เขียนตรง ข้อจำกัดจึงอยู่ที่ API ฝั่งเซิร์ฟเวอร์

ข้อจำกัดนี้ลดการสร้างออเดอร์และไฟล์จำนวนมากจาก QR/บัญชีเดียว ไม่ใช่ระบบป้องกัน DDoS หรือการสร้างหลายบัญชี ส่วนอายุสูงสุด QR และการออก QR ใหม่โดยคงบิลเดิม ดู docs/customer-qr-expiry.md

อ้างอิง: [PostgreSQL transaction locks](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

ผลตรวจรอบนี้: ชุดทดสอบ 177/177 ผ่าน, TypeScript ผ่าน, lint ของไฟล์ที่แก้ผ่าน และ SQL smoke check ผ่านบนตารางชั่วคราวของ Supabase ส่วน production build คอมไพล์และตรวจ TypeScript ผ่าน แต่จบไม่สำเร็จเนื่องจาก EPERM ตอนสร้างโฟลเดอร์ผลลัพธ์บน Windows; การลอง webpack ด้วย worker เดียวและโฟลเดอร์ใหม่ยังติด EPERM จึงยังไม่อ้างว่า build ผ่าน คืนค่า next.config.ts, tsconfig.json และ next-env.d.ts หลังตรวจแล้ว ยังไม่มีการ push หรือ deploy

## ผลตรวจหลังรวมช่องทางอัปโหลด

- tests/menu-upload-quota.test.mjs เพิ่ม 10 กรณี ครอบคลุมโควตาข้ามช่องทาง คำขอพร้อมกันใน fixture ที่จำลอง transaction แบบเรียงลำดับ โควตารายวัน การไม่หักโควตาเมื่อแก้ข้อความ การแยกบัญชี การปฏิเสธต่างร้าน/บทบาท และความล้มเหลวของโควตาหรือ Storage
- รวม 200 tests ผ่าน, TypeScript ผ่าน และ lint เฉพาะไฟล์ที่แก้ในงานนี้ผ่าน
- รัน SQL จาก tests/write-rate-limit.sql.mjs บนตารางชั่วคราวใน Supabase แล้วผ่านและ rollback ไม่ใช่การทดสอบโหลดพร้อมกันบนฐานข้อมูลจริง
- Server Action คืน status: 429 และ retryAfter ในข้อมูลผลลัพธ์ ไม่ได้อ้างว่า HTTP ของ Server Action เปลี่ยนเป็น 429
- คำเตือน Advisor เดิมยังอยู่: [สิทธิ์ฟังก์ชัน anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [สิทธิ์ฟังก์ชัน authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [การป้องกันรหัสผ่านรั่ว](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- ยังไม่ได้ทดสอบอัปโหลดจริงผ่านเบราว์เซอร์/Vercel และไม่ได้รัน production build ใหม่ในรอบนี้

## ปรับปรุงการอัปโหลด — 26 ตุลาคม 2026

- UI ทุกหน้าตรวจ MIME และขนาดด้วย lib/image-upload.ts รองรับ JPG/PNG/WebP/GIF ไม่เกิน 4 MiB; server ยังคงตรวจ signature และ decode ภาพจริง
- updateMenuItem ตรวจการอ้างอิงรูปใหม่ก่อน cleanup เมื่อบันทึก DB ล้มเหลว ถ้ามีการอ้างอิงหรืออ่าน DB ไม่ได้ จะเก็บไฟล์ไว้; เมื่อเมนูถูกลบระหว่างอัปโหลด จะตอบ 404 และ cleanup รูปใหม่ที่ไม่มีการอ้างอิง
- ทดสอบทั้งหมด 331/331 ผ่าน พร้อม TypeScript และ ESLint ไม่มีคำเตือน
- การทดสอบ HTTP ผ่าน Next dev fixture ถูก automatic approval review บล็อกเนื่องจากการเชื่อมต่อ telemetry ภายนอกที่ไม่ทราบ payload จึงยังไม่ได้ยืนยันผ่าน transport จริง; ไม่ได้ rerun วิธีเดิม
- ยังไม่ได้ push/deploy หรือเปลี่ยนการตั้งค่า Storage bucket; หลัง deploy ควรทดสอบเพิ่ม/แก้เมนูและโลโก้ด้วยรูปเล็ก, 2 MB, ใกล้ 4 MB และเกิน 4 MB

## ตั้งข้อจำกัด Storage bucket — 26 ตุลาคม 2026

ตั้ง menu-photos และ restaurant-logos ผ่าน Storage API แล้ว: file_size_limit = 4,194,304 bytes และ allowed_mime_types = image/jpeg, image/png, image/webp, image/gif โดยคง public = true เดิม ตรวจอ่านค่าจริงผ่าน Supabase SQL แล้วทั้งสอง bucket ตรงตามกำหนด มีผลทันทีโดยไม่ต้อง deploy แอป

ยังไม่ได้ทดสอบอัปโหลดจริงรอบนี้ เนื่องจาก automatic approval review ปฏิเสธการติดตามคำสั่งที่เกี่ยวข้องกับ telemetry ภายนอก ดูรายละเอียด ผลตรวจ และวิธีตรวจซ้ำใน docs/maintenance-plan-2026-10-26.md ลำดับ 3
