import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteStorageFile } from "@/utils/supabase/storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const oldUrl = formData.get("oldUrl") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // ตรวจสอบชนิดไฟล์ (เฉพาะรูปภาพ)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    const rawBucket = (formData.get("bucket") as string) || "menu-photos";
    const targetBucket = rawBucket === "restaurant-logos" ? "restaurant-logos" : "menu-photos";

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey);

    // สร้างชื่อไฟล์ที่ไม่ซ้ำกัน
    const ext = file.name.split(".").pop() || "jpg";
    const prefix = targetBucket === "restaurant-logos" ? "logo" : "menu";
    const folder = targetBucket === "restaurant-logos" ? "logos" : "items";
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // แปลงไฟล์เป็น ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // อัปโหลดเข้า bucket ที่ระบุ
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(`Supabase storage upload error in ${targetBucket}:`, uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // ลบรูปภาพเก่าออกจาก Bucket ทันที เพื่อป้องกันไฟล์ขยะสะสม
    if (oldUrl) {
      await deleteStorageFile(oldUrl, targetBucket);
    }

    // ดึง Public URL ของรูปภาพ
    const { data: publicUrlData } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(uploadData.path);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: uploadData.path,
    });
  } catch (error: unknown) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// DELETE /api/upload - ลบไฟล์รูปภาพออกจาก Supabase Storage Bucket
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { url, bucket = "restaurant-logos" } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "No URL provided" },
        { status: 400 }
      );
    }

    const targetBucket = bucket === "restaurant-logos" ? "restaurant-logos" : "menu-photos";
    const success = await deleteStorageFile(url, targetBucket);

    return NextResponse.json({ success });
  } catch (error: unknown) {
    console.error("Delete upload API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
