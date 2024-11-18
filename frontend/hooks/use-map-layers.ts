"use client";

import { useEffect } from "react";
import { type Map } from "@maptiler/sdk";
import { type LayerType } from "@/types/map";

export function useMapLayers(map: Map | null, layerType: LayerType) {
  useEffect(() => {
    if (!map) return;

    const layers = ["water-layer", "forests-layer"];
    layers.forEach((layer) => {
      if (map.getLayer(layer)) {
        map.removeLayer(layer);
        map.removeSource(layer.replace("-layer", "-source"));
      }
    });

    const loadLayer = async (type: string) => {
      try {
        const response = await fetch(`/data/${type}.json`);
        const data = await response.json();

        map.addSource(`${type}-source`, {
          type: "geojson",
          data: data,
        });

        map.addLayer({
          id: `${type}-layer`,
          type: "fill",
          source: `${type}-source`,
          layout: {},
          paint: {
            "fill-color": type === "water" ? "#00008B" : "#008000",
            "fill-opacity": type === "water" ? 1 : 0.5,
          },
        });
      } catch (error) {
        console.error(`Error loading ${type} data:`, error);
      }
    };

    if (layerType === "water" || layerType === "all") loadLayer("water");
    if (layerType === "forests" || layerType === "all") loadLayer("forests");
  }, [map, layerType]);
}