import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapIcon } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 space-y-4">
      <h1 className="text-4xl font-bold text-center">Geospatial Segmentation</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Interactive semantic segmentation on WMS service images with on-device processing
      </p>
      <Link href="/maps">
        <Button className="gap-2">
          <MapIcon className="h-4 w-4" />
          Open Map
        </Button>
      </Link>
    </main>
  );
}