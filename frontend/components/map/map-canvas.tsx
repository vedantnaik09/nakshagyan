"use client";

import { useRef, useEffect } from "react";
import * as maptilersdk from "@maptiler/sdk";
import { type MapRef } from "@/types/map";

interface MapCanvasProps {
  onMapLoad: (map: maptilersdk.Map) => void;
  rectangleActive: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

const MAPTILER_API_KEY = "vMUChi7LxgWHU4DOJoFH";

export function MapCanvas({
  onMapLoad,
  rectangleActive,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: MapCanvasProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map: MapRef = useRef<maptilersdk.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    maptilersdk.config.apiKey = MAPTILER_API_KEY;
    map.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.SATELLITE,
      center: [72.8777, 19.076],
      zoom: 12,
      preserveDrawingBuffer: true,
      dragPan: !rectangleActive,
    });

    map.current.on("load", () => {
      if (map.current) {
        map.current.resize();
        onMapLoad(map.current);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [onMapLoad]);

  useEffect(() => {
    if (!map.current) return;
    rectangleActive ? map.current.dragPan.disable() : map.current.dragPan.enable();
  }, [rectangleActive]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{ cursor: rectangleActive ? "crosshair" : "grab" }}
    />
  );
}