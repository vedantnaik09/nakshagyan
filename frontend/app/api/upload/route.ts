import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { base64Image, folderName, fileName } = await req.json();

    if (!base64Image || !folderName || !fileName) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const response = await cloudinary.uploader.upload(base64Image, {
      folder: folderName,
      public_id: fileName.split(".")[0],
      resource_type: "image",
    });

    return NextResponse.json({ secure_url: response.secure_url });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
