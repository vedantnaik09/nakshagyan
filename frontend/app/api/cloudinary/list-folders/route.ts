import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET!,
});

export async function GET() {
  try {
    // Get all folders that start with "Run_"
    const result = await cloudinary.api.root_folders();
    const folders = result.folders
      .filter((folder: any) => folder.name.startsWith('Run_'))
      .map((folder: any) => folder.name);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error fetching Cloudinary folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}