import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // สร้างชื่อไฟล์ที่ไม่ซ้ำกัน
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `items/${fileName}`;

    // แปลงไฟล์เป็น ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // อัปโหลดเข้า bucket 'menu-photos'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("menu-photos")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // ดึง Public URL ของรูปภาพ
    const { data: publicUrlData } = supabase.storage
      .from("menu-photos")
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
