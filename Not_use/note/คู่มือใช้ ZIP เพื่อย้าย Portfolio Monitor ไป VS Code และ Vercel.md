# คู่มือใช้ ZIP เพื่อย้าย Portfolio Monitor ไป VS Code และ Vercel

ไฟล์ ZIP ที่แนบมานี้มี source code สำหรับเปิดใน VS Code และ deploy บน Vercel แล้ว โดยไม่มี `node_modules`, build output, log, token, database password หรือ Google Client Secret

## ส่วนที่ 1 — เปิดใน VS Code

1. ดาวน์โหลด `portfolio-monitor-portable-source-2026-08-19.zip` แล้วแตกไฟล์ไว้ในโฟลเดอร์ที่หาได้ง่าย เช่น `Documents/portfolio-monitor` ห้ามเปิดหรือแก้ไฟล์ใน ZIP โดยตรง
2. เปิด VS Code แล้วเลือก **File → Open Folder...** จากนั้นเลือกโฟลเดอร์ `portfolio-monitor` ที่เพิ่งแตกไฟล์
3. เปิด Terminal ใน VS Code ด้วยเมนู **Terminal → New Terminal**
4. ตรวจว่าเครื่องมี Node.js 22 หรือใหม่กว่า โดยพิมพ์ `node -v` หากไม่มี ให้ติดตั้ง Node.js LTS จาก <https://nodejs.org>
5. ใน Terminal ให้รันทีละบรรทัด:

```bash
corepack enable
pnpm install
pnpm generate:jwt-secret
```

6. คัดลอกข้อความยาวที่แสดงจากคำสั่งสุดท้ายเก็บไว้เป็น `JWT_SECRET` จากนั้นสร้างไฟล์ชื่อ `.env.local` ที่ root ของโฟลเดอร์ และใส่ค่าตามนี้ โดยแทนค่าที่อยู่ใน `<...>` ด้วยข้อมูลจริงของคุณ:

```dotenv
APP_BASE_URL=http://localhost:3000
SUPABASE_DATABASE_URL=postgresql://postgres.nwtbcbgsvmmxjevjiruq:<DATABASE_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET=<ข้อความจาก pnpm generate:jwt-secret>
GOOGLE_OAUTH_CLIENT_ID=<Google Client ID เดิม>
GOOGLE_OAUTH_CLIENT_SECRET=<Google Client Secret เดิม>
```

7. ทดสอบบนเครื่องด้วยคำสั่ง:

```bash
pnpm test
pnpm check
pnpm dev
```

หากไม่มี error ให้เปิด `http://localhost:3000` ใน Chrome

## ส่วนที่ 2 — สร้าง Vercel project จาก ZIP

1. ไปที่ <https://vercel.com/ake-xiaomi11> ซึ่งคุณลงชื่อเข้าใช้ไว้แล้ว
2. ที่หน้า Projects ให้ลากไฟล์ ZIP จากโฟลเดอร์ Downloads มาวางบริเวณหน้าเว็บที่เขียนว่า **“drop a file, folder, or .zip to deploy”**
3. ตั้งชื่อ project เป็น `portfolio-monitor` แล้วกด Deploy หาก Vercel ถาม Framework ให้เลือก **Other**
4. รอ deployment แรกเสร็จแล้วจด URL ที่ Vercel แสดง เช่น `https://portfolio-monitor-xxxx.vercel.app` การ deploy รอบแรกอาจเปิดหน้าได้ไม่สมบูรณ์ เพราะยังไม่ได้ใส่ secrets ซึ่งเป็นเรื่องปกติ

## ส่วนที่ 3 — ใส่ Environment Variables ใน Vercel

1. ใน Vercel เปิด project `portfolio-monitor` แล้วเลือก **Settings → Environment Variables**
2. เพิ่มตัวแปรแต่ละตัวต่อไปนี้สำหรับ **Production** และ **Preview**:

| ชื่อ | ค่า |
|---|---|
| `SUPABASE_DATABASE_URL` | URL Transaction pooler เดียวกับที่ทดสอบ Supabase สำเร็จ |
| `JWT_SECRET` | ค่าเดียวกับใน `.env.local`; ต้องคงเดิมทุก deployment |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Client ID เดิม |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Client Secret เดิม |
| `APP_BASE_URL` | URL ของ Vercel project โดยไม่มี `/` ท้าย URL |

3. หลังใส่ครบ ให้ไปที่ **Deployments** กดเมนูจุดสามจุดของ deployment ล่าสุด แล้วเลือก **Redeploy**

## ส่วนที่ 4 — ตั้ง Google OAuth ก่อนทดสอบ login

1. ไปที่ <https://console.cloud.google.com/apis/credentials> และเลือก OAuth client เดิมของ Portfolio Monitor
2. ใน **Authorized redirect URIs** เพิ่มบรรทัดนี้ โดยแทน `<VERCEL_URL>` ด้วย URL จริงจาก Vercel:

```text
https://<VERCEL_URL>/api/auth/google/callback
```

3. กด **Save** แล้วกลับไปเปิด Vercel URL อีกครั้ง
4. ทดลอง Google login, ตรวจข้อมูลจาก Sheet `Stock`, และบันทึก Provident Fund หนึ่งรายการจริง จากนั้นดูใน Supabase ว่าข้อมูลถูกบันทึกแล้ว

> ห้ามใส่ password, Supabase URL ที่มี password, หรือ Google Client Secret ลง GitHub และห้ามส่งค่าเหล่านี้ในแชต ไฟล์ `.env.local` ถูกตั้งให้ Git ignore แล้ว

## หากมีปัญหา

ส่ง screenshot ของ error และบรรทัดท้าย ๆ จาก **Vercel → Project → Logs** ให้ผมดูได้ โดยปิด/เบลอ password และ token ก่อนเสมอ
