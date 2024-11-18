"use client";

import React, { useRef, useEffect, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { MapControls } from "@/components/MapControls";
import { cn } from "@/lib/utils";
import { Square } from "lucide-react";

const MAPTILER_API_KEY = "vMUChi7LxgWHU4DOJoFH";

export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rectangleActive, setRectangleActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCoords, setStartCoords] = useState({ x: 0, y: 0 });
  const [endCoords, setEndCoords] = useState({ x: 0, y: 0 });
  const [layerType, setLayerType] = useState<"water" | "forests" | "none" | "all">("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (map.current) return;

    maptilersdk.config.apiKey = MAPTILER_API_KEY;
    map.current = new maptilersdk.Map({
      container: mapContainer.current as HTMLDivElement,
      style: maptilersdk.MapStyle.SATELLITE,
      center: [72.8777, 19.076],
      zoom: 12,
      preserveDrawingBuffer: true,
      dragPan: !rectangleActive,
    });

    map.current.on('load', () => {
      map.current?.resize();
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;
    rectangleActive ? map.current.dragPan.disable() : map.current.dragPan.enable();
  }, [rectangleActive]);

  useEffect(() => {
    if (!map.current) return;

    const layers = ['water-layer', 'forests-layer'];
    layers.forEach(layer => {
      if (map.current?.getLayer(layer)) {
        map.current.removeLayer(layer);
        map.current.removeSource(layer.replace('-layer', '-source'));
      }
    });

    const loadLayer = async (type: string) => {
      try {
        const response = await fetch(`/data/${type}.json`);
        const data = await response.json();
        
        map.current?.addSource(`${type}-source`, {
          type: "geojson",
          data: data,
        });

        map.current?.addLayer({
          id: `${type}-layer`,
          type: "fill",
          source: `${type}-source`,
          layout: {},
          paint: {
            "fill-color": type === 'water' ? "#00008B" : "#008000",
            "fill-opacity": type === 'water' ? 1 : 0.5,
          },
        });
      } catch (error) {
        console.error(`Error loading ${type} data:`, error);
      }
    };

    if (layerType === "water" || layerType === "all") loadLayer('water');
    if (layerType === "forests" || layerType === "all") loadLayer('forests');
  }, [layerType]);

  const downloadImage = async (base64Image: string) => {
    const link = document.createElement("a");
    link.href = base64Image;
    link.download = `map-segment-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    if (rectangleActive) {
      setIsDrawing(false);
      setLoading(true);
      await captureScreenshot();
      setLoading(false);
    }
  };

  const captureScreenshot = async () => {
    const { x: startX, y: startY } = startCoords;
    const { x: endX, y: endY } = endCoords;
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    try {
      const canvas = await html2canvas(mapContainer.current as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const croppedCanvas = document.createElement("canvas");
      const croppedContext = croppedCanvas.getContext("2d");

      croppedCanvas.width = width * 2;
      croppedCanvas.height = height * 2;

      const minX = Math.min(startX, endX) * 2;
      const minY = Math.min(startY, endY) * 2;

      croppedContext?.drawImage(
        canvas,
        minX,
        minY,
        width * 2,
        height * 2,
        0,
        0,
        width * 2,
        height * 2
      );

      const croppedImage = croppedCanvas.toDataURL("image/png", 1.0);
      await downloadImage(croppedImage);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar onLayerChange={setLayerType} currentLayer={layerType} />
      <div className="flex-1 relative">
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
        
        <div
          ref={mapContainer}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: rectangleActive ? "crosshair" : "grab" }}
        />
        
        {rectangleActive && isDrawing && (
          <div
            className="absolute border-2 border-primary border-dashed pointer-events-none"
            style={{
              left: Math.min(startCoords.x, endCoords.x),
              top: Math.min(startCoords.y, endCoords.y),
              width: Math.abs(endCoords.x - startCoords.x),
              height: Math.abs(endCoords.y - startCoords.y),
            }}
          />
        )}
        
        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}