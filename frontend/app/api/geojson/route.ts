import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Parse the incoming JSON request body
        const { geoJSONString, title } = await request.json();

        // Ensure the /public/data directory exists
        const dataDir = path.join(process.cwd(), 'public', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Default to 'unlabeled' if no title is provided
        const fileName = title ? `${title}.geojson` : 'unlabeled.geojson';
        const filePath = path.join(dataDir, fileName);

        // Save the GeoJSON data to a file
        fs.writeFileSync(filePath, geoJSONString, 'utf8');

        // Return a success response
        return NextResponse.json(
            { message: 'GeoJSON file saved successfully' },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error saving GeoJSON:', error);

        // Return an error response
        return NextResponse.json(
            { message: 'Failed to save GeoJSON file', error: error.message },
            { status: 500 }
        );
    }
}


export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fileName = searchParams.get('file');

        if (!fileName) {
            return NextResponse.json(
                { message: 'File name not provided' },
                { status: 400 }
            );
        }

        const filePath = path.join(process.cwd(), 'public', 'data', `${fileName}.geojson`);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { message: 'GeoJSON file not found' },
                { status: 404 }
            );
        }

        const fileData = fs.readFileSync(filePath, 'utf8');

        return NextResponse.json(JSON.parse(fileData), { status: 200 });
    } catch (error: any) {
        console.error('Error fetching GeoJSON:', error);
        return NextResponse.json(
            { message: 'Failed to fetch GeoJSON file', error: error.message },
            { status: 500 }
        );
    }
}