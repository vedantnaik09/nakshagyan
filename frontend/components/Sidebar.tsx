// Sidebar.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Droplet, Trees, Layers, Globe2, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

const MODEL_URL = "/models/39epochs_g.onnx";
const TEST_IMAGE_URL = "/image.png";

interface SidebarProps {
  onLayerChange: (type: "water" | "forests" | "none" | "all") => void;
  currentLayer: "water" | "forests" | "none" | "all";
  handleSetWMSURL: (url: string) => void;
  availableLayers: string[];
  handleWMSLayerChange: (layer: string) => void;
  handleSatelliteLayerChange: (layer: string) => void;
  onSetCoordinates: (coordinates: { lat: number; lon: number }) => void;
  handleToggleGeoServerLayer: () => void; // New prop for toggling GeoServer layer
  geoServerLayerVisible: boolean; // New prop for layer visibility (optional)
}

export const Sidebar: React.FC<SidebarProps> = ({
  onLayerChange,
  currentLayer,
  handleSetWMSURL,
  availableLayers,
  handleWMSLayerChange,
  handleSatelliteLayerChange,
  onSetCoordinates,
  handleToggleGeoServerLayer, // Destructure the new prop
  geoServerLayerVisible, // Destructure the new prop (optional)
}) => {
  const [loading, setLoading] = useState(false);
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [activeWMSLayer, setActiveWMSLayer] = useState<string | null>(null);
  const [activeSatelliteLayer, setActiveSatelliteLayer] = useState<
    string | null
  >(null);

  useEffect(() => {
    const initializeBackend = async () => {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        console.log(
          "TensorFlow.js is using the WebGL backend for GPU acceleration."
        );
      } catch (error) {
        console.error("Error initializing TensorFlow.js WebGL backend:", error);
      }
    };
    initializeBackend();
  }, []);

  const handleGoClick = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (!isNaN(lat) && !isNaN(lon)) {
      onSetCoordinates({ lat, lon });
    } else {
      console.error("Invalid latitude or longitude");
      alert("Please enter valid latitude and longitude values.");
    }
  };

  const layers = [
    {
      id: "water",
      name: "Water Bodies",
      icon: Droplet,
      description: "Show water bodies and water features",
    },
    {
      id: "forests",
      name: "Forest Areas",
      icon: Trees,
      description: "Show forest coverage and vegetation",
    },
    {
      id: "all",
      name: "All Layers",
      icon: Layers,
      description: "Show all available layers",
    },
  ] as const;

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Layers Section */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Layers</h2>
            <div className="space-y-1">
              {layers.map((layer) => (
                <Button
                  key={layer.id}
                  onClick={() => onLayerChange(layer.id)}
                  variant={currentLayer === layer.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2",
                    currentLayer === layer.id &&
                    "bg-primary text-primary-foreground"
                  )}
                  title={`Activate ${layer.description}`}
                >
                  <layer.icon
                    className={cn(
                      "h-4 w-4",
                      currentLayer === layer.id &&
                      "border-2 border-red-500 rounded"
                    )}
                  />
                  {layer.name}
                </Button>
              ))}
              <Separator className="my-2" />
              <Button
                onClick={() => onLayerChange("none")}
                variant={currentLayer === "none" ? "default" : "ghost"}
                className="w-full justify-start"
                title="Clear all layers"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Set WMS URL Section */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Set WMS URL</h2>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Paste WMS URL here..."
                className="w-full border rounded-md p-2 bg-secondary/50"
                onChange={(e) => handleSetWMSURL(e.target.value)}
              />
            </div>
          </div>

          {/* Jump to Coordinates Section */}
          <div className="w-fit">
            <h2 className="text-lg font-semibold mb-2">Jump to Coordinates</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Latitude"
                className="flex-1 border rounded-md p-2 bg-secondary/50 w-36"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <input
                type="text"
                placeholder="Longitude"
                className="flex-1 border rounded-md p-2 bg-secondary/50 w-36"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
              <Button
                onClick={handleGoClick}
                className="bg-primary text-primary-foreground px-6"
              >
                Go
              </Button>
            </div>
          </div>

          {/* Available Layers Section */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Available Layers</h2>
            {availableLayers.length > 0 ? (
              <div className="space-y-2 h-72 overflow-y-scroll">
                {availableLayers.map((layer, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-secondary/50 p-2 rounded-lg"
                  >
                    <span className="flex-grow font-medium">{layer}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveWMSLayer(layer);
                          handleWMSLayerChange(layer);
                        }}
                        title="Set layer to view"
                      >
                        <Globe2
                          color={`${activeWMSLayer === layer ? "green" : "white"
                            }`}
                          className="h-4 w-4"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveSatelliteLayer(layer);
                          handleSatelliteLayerChange(layer);
                        }}
                        title="Set layer for satellite segmentation"
                      >
                        <Satellite
                          color={`${activeSatelliteLayer === layer ? "green" : "white"
                            }`}
                          className="h-4 w-4"
                        />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No layers available</p>
            )}
          </div>

          {/* GeoServer Layer Toggle Section */}
          <div>
            <h2 className="text-lg font-semibold mb-2">GeoServer Layer</h2>
            <Button
              onClick={handleToggleGeoServerLayer}
              className="w-full justify-start gap-2"
              variant="ghost"
              title="Toggle GeoServer Image Mosaic Layer"
            >
              <Globe2 className="h-4 w-4" />
              {geoServerLayerVisible ? "Hide" : "Show"} GeoServer Layer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
