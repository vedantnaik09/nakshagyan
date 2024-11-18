interface MapControlsProps {
  children: React.ReactNode;
}

export function MapControls({ children }: MapControlsProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-sm">
      <div className="p-1 flex items-center gap-1">
        {children}
      </div>
    </div>
  );
}