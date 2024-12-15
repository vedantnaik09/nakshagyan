'use client';

export function MapLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary/50 border-gray-300" />
      <span className="text-white ml-4 text-lg font-bold">Loading Satellite Data...</span>
    </div>
  );
}
