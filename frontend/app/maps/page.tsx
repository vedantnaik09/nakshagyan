'use client'
import dynamic from 'next/dynamic';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MapComponent = dynamic(() => import('@/components/maps/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  ),
});

export default function MapPage() {
  return (
    <main className="flex h-full w-full flex-col">
      <ToastContainer />
      <MapComponent />
    </main>
  );
}