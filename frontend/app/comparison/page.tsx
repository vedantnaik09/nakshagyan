'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface ImagePair {
  runId: string;
  tile: string;
  segmented: string;
  timestamp: Date;
}

export default function ComparisonPage() {
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([]);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch('/api/cloudinary/list-folders');
        const data = await response.json();
        const pairs = data.folders.map((folder: string) => ({
          runId: folder,
          tile: `https://res.cloudinary.com/${cloudName}/${folder}/tile.png`,
          segmented: `https://res.cloudinary.com/${cloudName}/${folder}/segmented.png`,
          timestamp: new Date(folder.split('_')[1].replace(/T/g, ' ').replace(/_/g, ':'))
        }));
        setImagePairs(pairs.sort((a: { timestamp: { getTime: () => number; }; }, b: { timestamp: { getTime: () => number; }; }) => b.timestamp.getTime() - a.timestamp.getTime()));
      } catch (error) {
        console.error('Error fetching image pairs:', error);
      }
    };

    fetchImages();
  }, [cloudName]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Image Comparisons</h1>
      <div className="grid gap-8">
        {imagePairs.map((pair) => (
          <Card key={pair.runId} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Original Tile</h3>
                <img
                  src={pair.tile}
                  alt="Original tile"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Segmented Result</h3>
                <img
                  src={pair.segmented}
                  alt="Segmented result"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}