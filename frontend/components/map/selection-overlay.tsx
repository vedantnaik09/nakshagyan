interface SelectionOverlayProps {
  isDrawing: boolean;
  startCoords: { x: number; y: number };
  endCoords: { x: number; y: number };
}

export function SelectionOverlay({
  isDrawing,
  startCoords,
  endCoords,
}: SelectionOverlayProps) {
  if (!isDrawing) return null;

  return (
    <div
      className="absolute border-2 border-primary border-dashed pointer-events-none"
      style={{
        left: Math.min(startCoords.x, endCoords.x),
        top: Math.min(startCoords.y, endCoords.y),
        width: Math.abs(endCoords.x - startCoords.x),
        height: Math.abs(endCoords.y - startCoords.y),
      }}
    />
  );
}