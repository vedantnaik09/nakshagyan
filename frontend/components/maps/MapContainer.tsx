'use client';

import dynamic from 'next/dynamic';
import { MapLoader } from '@/components/maps/MapLoader';

const MapComponent = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <MapLoader />
});

export function MapContainer() {
    return <MapComponent />;
}