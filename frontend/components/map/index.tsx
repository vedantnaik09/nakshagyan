"use client";

import { useState, useCallback } from "react";
import { type Map } from "@maptiler/sdk";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapCanvas } from "./map-canvas";
import { MapControls } from "./map-controls";
import { Sidebar } from "./sidebar";
import { SelectionOverlay } from "./selection-overlay";
import { LoadingOverlay } from "./loading-overlay";
import { useMapLayers } from "@/hooks/use-map-layers";
import { downloadMapSegment } from "@/lib/map-utils";
import { type LayerType, type Coordinates } from "@/types/map";
import html2canvas from "html2canvas";

export default function Map() {
  const [map, setMap] = useState<Map | null>(null);
  const [rectangleActive, setRectangleActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCoords, setStartCoords] = useState<Coordinates>({ x: 0, y: 0 });
  const [endCoords, setEndCoords] = useState<Coordinates>({ x: 0, y: 0 });
  const [layerType, setLayerType] = useState<LayerType>("none");
  const [loading, setLoading] = useState(false);

  useMapLayers(map, layerType);

  const handleMapLoad = useCallback((mapInstance: Map) => {
    setMap(mapInstance);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (rectangleActive) {
      setIsDrawing(true);
      setStartCoords({ x: e.clientX, y: e.clientY });
      setEndCoords({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (rectangleActive && isDrawing) {
      setEndCoords({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = async () => {
    if (!rectangleActive) return;
    
    setIsDrawing(false);
    setLoading(true);
    
    try {
      const canvas = await html2canvas(document.querySelector(".map-container") as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const width = Math.abs(endCoords.x - startCoords.x) * 2;
      const height = Math.abs(endCoords.y - startCoords.y) * 2;
      const minX = Math.min(startCoords.x, endCoords.x) * 2;
      const minY = Math.min(startCoords.y, endCoords.y) * 2;

      const croppedCanvas = document.createElement("canvas");
      const ctx = croppedCanvas.getContext("2d");
      
      if (ctx) {
        croppedCanvas.width = width;
        croppedCanvas.height = height;
        ctx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
        
        const croppedImage = croppedCanvas.toDataURL("image/png", 1.0);
        await downloadMapSegment(croppedImage);
      }
    } catch (error) {
      console.error("Error capturing screenshot:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar onLayerChange={setLayerType} currentLayer={layerType} />
      <div className="flex-1 relative map-container">
        <MapControls>
          <Button
            variant={rectangleActive ? "default" : "secondary"}
            size="icon"
            onClick={() => setRectangleActive(!rectangleActive)}
            className={cn(
              "transition-all",
              rectangleActive && "bg-primary text-primary-foreground"
            )}
          >
            <Square className="h-4 w-4" />
          </Button>
        </MapControls>

        <MapCanvas
          onMapLoad={handleMapLoad}
          rectangleActive={rectangleActive}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {rectangleActive && (
          <SelectionOverlay
            isDrawing={isDrawing}
            startCoords={startCoords}
            endCoords={endCoords}
          />
        )}

        {loading && <LoadingOverlay />}
      </div>
    </div>
  );
}