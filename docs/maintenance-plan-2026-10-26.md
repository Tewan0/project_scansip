# แผนเก็บงาน ScanSip — 26 ตุลาคม 2026

| ลำดับ | งาน | สถานะ |
| --- | --- | --- |
| 1 | GitHub Actions CI: TypeScript, lint, tests | เพิ่ม workflow แล้ว รอตรวจครั้งแรกบน GitHub หลัง push |
| 2 | จำกัด description เมนู 1,000 ตัวอักษรที่ UI และ server ทั้งสามเส้นทาง | เสร็จแล้ว: tests 350/350 และ TypeScript ผ่าน |
| 3 | ตั้ง Storage buckets: 4 MiB และ MIME JPG/PNG/WebP/GIF | ตั้งค่าบน Supabase แล้ว ตรวจค่าจริงผ่าน SQL; รอทดสอบอัปโหลดจริง |
| 4 | ปรับ CTA หน้าแรกสำหรับพนักงาน | เสร็จแล้ว: role-access tests 12/12 และ TypeScript ผ่าน |
| 5 | ถอน file-saver, @types/file-saver, html-to-image และ jszip พร้อม lockfile | เสร็จแล้ว: ถอนรวม dependency ย่อย 14 แพ็กเกจ; tests 350/350 และ TypeScript ผ่าน |
| 6 | ลบ helper/actions ที่ไม่มีผู้เรียกและ oldUrl พร้อมรักษาการทดสอบสิทธิ์ | เสร็จแล้ว: tests 351/351 และ TypeScript ผ่าน |

## ลำดับ 1: CI

ไฟล์ .github/workflows/ci.yml ทำงานเมื่อ push ทุก branch, เปิด/อัปเดต PR และสั่งด้วย workflow_dispatch

ใช้ Ubuntu runner และ Node 24 ตาม major version ที่ใช้ทดสอบโปรเจกต์ จากนั้นรันตามลำดับ:

1. npm ci ติดตั้งตาม package-lock.json
2. npx --no-install next typegen สร้าง next-env.d.ts และ route types บน checkout ใหม่
3. npx --no-install tsc --noEmit
4. npm run lint -- --max-warnings=0
5. npm test รัน tests/*.test.mjs

- actions/checkout v7.0.1 และ actions/setup-node v7.1.0 pin ด้วย commit SHA ที่ตรวจจาก tag ทางการ
- GITHUB_TOKEN มีเพียง contents: read และ checkout ไม่เก็บ credential ไว้
- ใช้ pull_request ไม่ใช่ pull_request_target; ไม่มี production secrets ใน workflow
- cache เฉพาะ npm download cache ตาม lockfile ไม่ใช้ node_modules หรือ .next cache
- จำกัดเวลา job 15 นาที และยกเลิก run เก่าของกลุ่มเดียวกันเมื่อมี run ใหม่
- ไม่เรียก migration, SQL integration scripts หรือ Gemini จริง; tests ใช้ fixtures/mock services
- Vercel ยังคงรับผิดชอบ production build/deploy ตามเดิม

## การใช้งานหลัง push

ดูผลที่แท็บ Actions ของ repository โดย workflow ชื่อ CI และ job ชื่อ TypeScript, lint and tests

Workflow นี้แสดงผลตรวจ แต่ยังไม่ได้ตั้ง branch protection หรือ ruleset ให้ห้าม merge เมื่อไม่ผ่าน หากต้องการบังคับในอนาคต ให้กำหนด job นี้เป็น required status check หลังมี run บน GitHub แล้ว

## อ้างอิง

- https://github.com/actions/checkout/releases/tag/v7.0.1
- https://github.com/actions/setup-node/releases/tag/v7.1.0
- https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md: next typegen

## ผลตรวจลำดับ 1 ในเครื่อง

- YAML parse ผ่าน ตรวจ triggers, permissions, action SHA และลำดับคำสั่งแล้ว
- npm ci --dry-run --ignore-scripts --no-audit --no-fund ผ่าน เป็นการตรวจ dry-run ไม่ใช่การติดตั้งใหม่ทั้งหมด
- next typegen ผ่าน และ tsc --noEmit ผ่าน
- npm test ผ่าน 331/331
- การติดตามผล npm run lint -- --max-warnings=0 ถูก automatic approval review ปฏิเสธ โดยระบุการเชื่อมต่อ telemetry ภายนอกที่ไม่ทราบ payload จึงยังไม่ยืนยันผล lint ของรอบนี้ และไม่รันวิธีเดิมซ้ำ
- ยังไม่ได้ push หรือรัน workflow บน GitHub จริง ผลบน Ubuntu runner ต้องตรวจหลัง push
- ไม่แก้โค้ดแอปหรือการตั้งค่า production ในขั้นนี้

## ลำดับ 2: ความยาวคำอธิบายเมนู

- ใช้ MENU_DESCRIPTION_MAX_LENGTH = 1,000 ร่วมกันผ่าน lib/menu-fields.ts ซึ่งนำเข้าได้ทั้ง client และ server
- validateDescription รับเฉพาะข้อความหรือค่าว่าง ตรวจความยาวก่อน trim แล้วบันทึกข้อความที่ trim แล้ว; ช่องว่างล้วน/null/undefined เป็น null
- นับตาม JavaScript string.length และ textarea maxLength (UTF-16 code units) ให้ตรงกันทั้งสองฝั่ง
- ตรวจ POST /api/menu ทั้ง JSON/multipart, PATCH /api/menu/[id] และ updateMenuItem ก่อนเขียนฐานข้อมูลหรือเริ่มอัปโหลดรูป
- PATCH ที่ไม่ส่ง description จะเก็บข้อความเดิมไว้; ส่ง null เพื่อล้างข้อความได้
- หน้าเพิ่มและแก้ไขมี maxLength ตัวนับ และการตรวจตอนส่งฟอร์ม ข้อความเดิมที่เกินกำหนดยังแสดงครบและให้ผู้ใช้ย่อเอง ไม่มี migration ตัดข้อความเก่า
- เพิ่มการทดสอบขอบเขต 1,000/1,001 ภาษาไทย ค่าว่าง ชนิดข้อมูลผิด และการป้องกัน side effect รวมถึง UI ที่มีข้อความเก่ายาวเกินกำหนด
- ผลตรวจ: targeted tests 31/31, ชุดทดสอบทั้งหมด 350/350, tsc --noEmit ผ่าน และ git diff --check ผ่าน
- ไม่รัน lint ซ้ำในรอบนี้ เนื่องจากข้อจำกัด automatic approval review ที่บันทึกไว้ในลำดับ 1; ยังไม่ยืนยันผล lint รอบนี้
- ยังไม่ได้ commit/push การแก้ไขในรอบนี้

## ลำดับ 3: จำกัดไฟล์ที่ Storage bucket

ตั้งค่าบน Supabase project rcomsfffumefjvczfrye แล้วเมื่อ 26 ตุลาคม 2026 ผ่าน Storage API updateBucket โดยอ่านค่าจาก lib/image-upload.ts

| Bucket | file_size_limit (bytes) | allowed_mime_types | public |
| --- | --- | --- | --- |
| menu-photos | 4194304 | image/jpeg, image/png, image/webp, image/gif | true |
| restaurant-logos | 4194304 | image/jpeg, image/png, image/webp, image/gif | true |

- ค่าก่อนปรับ: file_size_limit และ allowed_mime_types เป็น null ทั้งสอง bucket
- ใช้ updateBucket โดยส่ง public ตามค่าเดิม; ไม่แก้ RLS, global limit, ไฟล์เดิม หรือข้อมูลเมนู
- เป็นข้อจำกัดอัปโหลดเพิ่มเติมที่ Storage; การตรวจ signature และ decode ภาพฝั่งแอปยังทำงานตามเดิม
- การตั้งค่านี้มีผลบน Supabase แล้ว ไม่ต้องรอ push GitHub หรือ deploy Vercel
- ตรวจค่าหลังปรับผ่าน read-only SQL ใน Supabase plugin ยืนยันทั้งสอง bucket ตรงกับตารางข้างต้น
- ระหว่างติดตามผลคำสั่ง API, automatic approval review ปฏิเสธการทำงานด้วยเหตุผลว่ามี telemetry ไป dc.services.visualstudio.com ที่ไม่ทราบ payload จึงหยุดวิธีนั้น ไม่ rerun หรือเปลี่ยนทางเพื่อข้ามการปฏิเสธ
- ยังไม่ได้ทดสอบอัปโหลดจริงด้วยไฟล์ที่ขนาดพอดี/เกินหรือ MIME ผิด จึงไม่อ้างว่าทดสอบพฤติกรรม Storage ครบแล้ว
- ไม่มีการแก้ application code ในลำดับนี้ จึงไม่ได้รัน tests, TypeScript หรือ lint ใหม่; ผล 350/350 และ TypeScript ที่บันทึกไว้เป็นของลำดับ 2

### ตรวจซ้ำหรือใช้กับ Supabase project ใหม่

เปิด Storage > เลือก bucket > การตั้งค่า bucket ของ menu-photos และ restaurant-logos:

1. ตั้ง File size limit เป็น 4 MiB (4,194,304 bytes); หาก UI แสดงหน่วย MB ให้ตรวจค่า bytes ด้วย SQL ด้านล่าง
2. ตั้ง Allowed MIME types เป็น image/jpeg, image/png, image/webp, image/gif โดยระบุแยกประเภท ไม่ใช้ image/*
3. คงค่า Public เดิมและบันทึก; global file size limit ต้องไม่น้อยกว่า 4,194,304 bytes
4. ตรวจค่าด้วย SQL แบบอ่านอย่างเดียว:

~~~sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('menu-photos', 'restaurant-logos')
order by id;
~~~

การทดสอบที่ยังเหลือ: อัปโหลดภาพที่รองรับผ่านแอปทั้งเมนูและโลโก้; หากตรวจ Storage โดยตรง ให้ใช้ไฟล์ทดสอบชื่อใหม่ที่ไม่เกี่ยวกับข้อมูลร้าน ตรวจว่าไฟล์ 4,194,304 bytes ผ่าน, 4,194,305 bytes ถูกปฏิเสธ และ image/svg+xml ถูกปฏิเสธ แล้วลบเฉพาะไฟล์ทดสอบผ่าน Storage API การทดสอบผ่าน UI อย่างเดียวไม่ได้ยืนยันข้อจำกัดระดับ bucket เพราะ UI/server อาจปฏิเสธก่อนถึง Storage

หากจำเป็นต้องคืนค่าก่อนปรับ ให้ปิดข้อจำกัดขนาดและ MIME ในการตั้งค่าของสอง bucket นี้เท่านั้น (กลับเป็น null) โดยคง Public เดิม การคืนค่านี้ทำให้เสียการป้องกันชั้น bucket แต่ยังมี validation ของแอป

เอกสารอ้างอิง:
- https://supabase.com/docs/reference/javascript/storage-updatebucket
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/docs/guides/storage/schema/design

## ลำดับ 4: ข้อความปุ่มหน้าแรกสำหรับพนักงาน

- app/page.tsx ใช้ข้อความกลางสำหรับผู้เข้าสู่ระบบที่ไม่ได้เป็นเจ้าของร้าน: ปุ่มส่วนหัวบนมือถือแสดง “เข้าทำงาน” และข้อความเต็มแสดง “เข้าสู่พื้นที่ทำงาน” ทั้งส่วนหัว ส่วนแนะนำ และส่วนท้ายหน้า
- พนักงานจึงไม่เห็นข้อความ “ตั้งค่าร้าน” บนปุ่มส่วนหัว ข้อความกลางนี้ใช้กับบัญชีใหม่ที่ยังไม่มีร้านด้วย
- ปลายทางเดิม /workspace ตรวจสิทธิ์ก่อนส่ง cashier ไป /frontdesk และ kitchen ไป /kitchen; บัญชีที่ยังไม่มีสิทธิ์ร้านจะเห็นหน้าคำเชิญตามพฤติกรรมเดิม
- เจ้าของร้านยังเห็น “แดชบอร์ด” / “เข้าสู่แดชบอร์ดร้าน” ไป /owner/dashboard และผู้ยังไม่เข้าสู่ระบบเห็น “เริ่มต้นใช้งาน” ไป /owner/login
- เปลี่ยนเฉพาะข้อความ 2 จุด ไม่มีการแก้ระบบสิทธิ์หรือเพิ่ม query
- ตรวจด้วย tests/role-access.test.mjs ผ่าน 12/12, tsc --noEmit ผ่าน และ git diff --check ผ่าน; ไม่ได้ทดสอบภาพผ่านเบราว์เซอร์หรือรัน lint ใหม่ในรอบนี้
- ยังไม่ได้ commit/push

## ลำดับ 5: ถอน dependencies ที่ไม่ได้ใช้งาน

- ตรวจชื่อแพ็กเกจและรูปแบบการเรียก saveAs/toPng/toJpeg/JSZip ใน source และ tests รวมไฟล์ untracked แล้วไม่พบผู้ใช้งาน
- การส่งออก CSV ใน app/dashboard/reports/page.tsx ใช้ Blob, URL.createObjectURL และลิงก์ download ของเบราว์เซอร์
- ถอน file-saver, @types/file-saver, html-to-image และ jszip ด้วย npm uninstall แบบ offline, ignore-scripts, no-audit และ no-fund
- package.json, package-lock.json และ node_modules อัปเดตแล้ว ลบรวม dependency ย่อย 14 แพ็กเกจ
- ตรวจ lockfile แล้วไม่มีแพ็กเกจเพิ่มหรือการเปลี่ยน version/resolved/integrity ของแพ็กเกจที่เหลือ; inherits และ util-deprecate เปลี่ยนเป็น dev-only ตาม dependency graph หลังถอน jszip
- package.json ตรงกับ root dependencies ใน lockfile และทั้ง 4 แพ็กเกจไม่เหลือใน manifest, lockfile หรือ node_modules
- ชุดทดสอบทั้งหมดผ่าน 350/350, tsc --noEmit ผ่าน และ git diff --check ผ่าน
- npm แจ้ง Unknown env config http-proxy จาก environment ของเครื่อง แต่ถอนแพ็กเกจสำเร็จ exit code 0; ไม่เปลี่ยนการตั้งค่า environment ในงานนี้
- ไม่ได้รัน lint, production build หรือ npm ci แบบติดตั้งใหม่ในรอบนี้; ยังไม่ได้ commit/push

## ลำดับ 6: ลบโค้ดที่ไม่มีผู้เรียกใช้

- ตรวจผู้เรียกใน source และ tests รวมไฟล์ untracked ก่อนลบ
- utils/store.ts: ลบ generateSlug, getCurrentUserId และ getOrCreateStore รวม import auth ที่ไม่ใช้แล้ว; คง DEFAULT_STORE_CATEGORIES, getStoreById และ getStoreBySlugOrId ที่ยังใช้งาน
- app/actions/owner-auth.ts: ลบ signOutOwner ที่ไม่มีผู้เรียก; การออกจากระบบยังใช้ LogoutButton ส่ง POST /auth/signout พร้อมการตรวจ origin เดิม
- ลบ app/actions/table.ts ทั้งไฟล์ ซึ่งมีเพียง getStoreTables และ updateStoreTableCount; หน้าจัดการโต๊ะเรียก /api/tables อยู่แล้ว
- tests/role-access.test.mjs: ย้าย coverage ของการปรับจำนวนโต๊ะจาก action ที่ลบไปเป็น POST /api/tables (sync_tables) โดยใช้ auth fixture จริง ตรวจ anonymous ได้ 401, cashier/kitchen ได้ 403 และไม่มีการเขียนข้อมูล
- app/owner/onboarding/page.tsx: เอา formData oldUrl ที่ API ไม่อ่านออก ไม่มีการเพิ่มคำสั่งลบรูปอัตโนมัติ
- ตรวจซ้ำไม่พบการอ้างอิงฟังก์ชันหรือ actions/table ที่ลบใน source/tests
- ชุดทดสอบทั้งหมดผ่าน 351/351 รวม onboarding, store identity, signout, upload และ table management; tsc --noEmit และ git diff --check ผ่าน
- ไม่ได้รัน lint หรือ production build ใหม่ในรอบนี้; ยังไม่ได้ commit/push

## สถานะหลังทำครบทั้ง 6 ลำดับ

งานแก้โค้ดตามรายการและการตั้งค่า bucket เสร็จแล้ว ผลตรวจล่าสุดคือ 351 tests และ TypeScript ผ่าน ยังเหลือการยืนยันผลจากสภาพแวดล้อมจริง:

- Push การเปลี่ยนแปลง แล้วตรวจ GitHub Actions CI รวม lint และ Vercel deployment
- ทดสอบอัปโหลดจริงหลังตั้ง bucket limits ตามลำดับ 3; ปัจจุบันยืนยันค่าตั้งแล้ว แต่การทดสอบไฟล์จริงรอบนั้นยังไม่ได้ทำเนื่องจาก automatic approval review
- ผลเหล่านี้ไม่ใช่การรับรองว่าโปรเจกต์ไม่มีช่องโหว่ทุกชนิด
