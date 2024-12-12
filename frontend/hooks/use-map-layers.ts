"use client";

import { useEffect } from "react";
import { type Map } from "@maptiler/sdk";
import { type LayerType } from "@/types/map";

export function useMapLayers(map: Map | null, layerType: LayerType) {
  useEffect(() => {
    if (!map) return;

    // Layers to manage
    const layers = [
      "water",
      "vegetation",
      "road",
      "land",
      "building",
    ];

    // Remove existing layers
    layers.forEach((layer) => {
      if (map.getLayer(layer)) {
        map.removeLayer(layer);
        map.removeSource(layer.replace("-layer", "-source"));
      }
    });

    // Function to load the specific layer data
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
            "fill-color":
              type === "water" ? "#00008B" : // Blue for water
                type === "vegetation" ? "#228B22" : // Green for vegetation
                  type === "road" ? "#808080" : // Grey for roads
                    type === "land" ? "#D2B48C" : // Tan for land
                      type === "building" ? "#A9A9A9" : "#FFFFFF", // Dark gray for buildings
            "fill-opacity": 0.5, // Apply opacity for all layers
          },
        });
      } catch (error) {
        console.error(`Error loading ${type} data:`, error);
      }
    };

    // Conditionally load layers based on the layerType
    if (layerType === "water" || layerType === "all") loadLayer("water");
    if (layerType === "vegetation" || layerType === "all") loadLayer("vegetation");
    if (layerType === "road" || layerType === "all") loadLayer("road");
    if (layerType === "land" || layerType === "all") loadLayer("land");
    if (layerType === "building" || layerType === "all") loadLayer("building");

    // Hide all layers if 'none' is selected
    if (layerType === "none") {
      layers.forEach((layer) => {
        if (map.getLayer(layer)) {
          map.removeLayer(layer);
          map.removeSource(layer.replace("-layer", "-source"));
        }
      });
    }
  }, [map, layerType]);
}
