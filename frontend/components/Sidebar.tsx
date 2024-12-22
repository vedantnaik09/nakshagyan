// Sidebar.tsx

"use client";

import React, { useState, useEffect } from "react";
import { openDB } from "idb"; // Ensure idb is installed and imported
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Droplet,
  Trees,
  Home,        // Updated Icon for Building Areas
  MapPin,      // Updated Icon for Land Areas
  Globe2,
  Satellite,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
} from "lucide-react";
import { FaRoad } from "react-icons/fa"; // Imported BiRoad from react-icons
import { cn } from "@/lib/utils";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

const MODEL_URL = "/models/39epochs_g.onnx";
const TEST_IMAGE_URL = "/image.png";

interface SidebarProps {
  onLayerChange: (
    type:
      | "water"
      | "vegetation"
      | "road"
      | "land"
      | "building"
      | "none"
      | "all"
  ) => void;
  currentLayer:
  | "water"
  | "vegetation"
  | "road"
  | "land"
  | "building"
  | "none"
  | "all";
  handleSetWMSURL: (url: string) => void;
  availableLayers: string[];
  handleWMSLayerChange: (layer: string) => void;
  handleSatelliteLayerChange: (layer: string) => void;
  onSetCoordinates: (coordinates: { lat: number; lon: number }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onLayerChange,
  currentLayer,
  handleSetWMSURL,
  availableLayers,
  handleWMSLayerChange,
  handleSatelliteLayerChange,
  onSetCoordinates,
}) => {
  const [loading, setLoading] = useState(false);
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [activeWMSLayer, setActiveWMSLayer] = useState<string | null>(null);
  const [activeSatelliteLayer, setActiveSatelliteLayer] = useState<string | null>(
    null
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false); // State for collapse

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
      id: "vegetation",
      name: "Vegetation Areas",
      icon: Trees,
      description: "Show forest coverage and vegetation",
    },
    {
      id: "road",
      name: "Road Areas",
      icon: FaRoad, // Updated Icon from react-icons
      description: "Show road networks and infrastructures",
    },
    {
      id: "land",
      name: "Land Areas",
      icon: MapPin,
      description: "Show land usage and terrain",
    },
    {
      id: "building",
      name: "Building Areas",
      icon: Home,
      description: "Show building footprints and structures",
    },
    {
      id: "all",
      name: "All Layers",
      icon: Layers,
      description: "Show all available layers",
    },
    {
      id: "none",
      name: "None",
      icon: Layers,
      description: "Hide all layers",
    },
  ] as const;

  const downloadGeoJson = async (layerId: string) =>{
    try {
      // Open the IndexedDB database
      const db = await openDB("geojsonDB", 1);

      // Retrieve the GeoJSON data for the layer
      const data = await db.get("geojsonStore", layerId);

      if (data && data.geoJSON) {
        // Parse the GeoJSON string to ensure it is valid
        const geoJSON = JSON.parse(data.geoJSON);

        // Create a Blob from the GeoJSON data
        const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
          type: "application/json",
        });

        // Create a temporary download link
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${layerId}.geojson`;

        // Trigger the download
        downloadLink.click();

        // Clean up the temporary URL object
        URL.revokeObjectURL(downloadLink.href);
      } else {
        console.error(`GeoJSON data for layer "${layerId}" not found in IndexedDB.`);
      }
    } catch (error) {
      console.error("Error downloading GeoJSON from IndexedDB:", error);
    }
  
  }
  return (
    <div
      className={cn(
        "h-screen flex flex-col bg-background text-foreground transition-width duration-300",
        isCollapsed ? "w-20" : "w-[30vw] max-w-lg" // Adjusted width to ~30vw
      )}
    >
      {/* Header with Toggle Button */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && <h1 className="text-xl font-bold">Dashboard</h1>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
      </div>

      {/* Main Content with Unified Scrolling */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-background p-4">
        <div className="space-y-4">
          {/* Layers Section */}
          <div>
            {!isCollapsed && (
              <h2 className="text-lg font-semibold mb-4">Layers</h2>
            )}
            <div className="space-y-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between"
                >
                  <Button
                    onClick={() => onLayerChange(layer.id)}
                    variant={
                      currentLayer === layer.id ? "default" : "ghost"
                    }
                    className={cn(
                      "w-full justify-start gap-2",
                      currentLayer === layer.id &&
                      "bg-primary text-primary-foreground"
                    )}
                    title={`Activate ${layer.name}`}
                  >
                    <layer.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        currentLayer === layer.id &&
                        "text-accent-foreground"
                      )}
                    />
                    {!isCollapsed && (
                      <span className="flex-1 text-left truncate">
                        {layer.name}
                      </span>
                    )}
                  </Button>
                  {!isCollapsed && layer.id !== "none" && ( // Remove download button for 'none' layer
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadGeoJson(layer.id)}
                      title={`Download ${layer.name} GeoJSON`}
                      className="ml-2 flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {!isCollapsed && (
                <>
                  <Separator className="my-2 border-border" />
                  <Button
                    onClick={() => onLayerChange("none")}
                    variant="ghost" // Removed conditional highlight
                    className="w-full justify-start"
                    title="Clear all layers"
                  >
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Set WMS URL Section */}
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Set WMS URL</h2>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Paste WMS URL here..."
                  className="w-full border rounded-md p-2 bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground"
                  onChange={(e) => handleSetWMSURL(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Jump to Coordinates Section */}
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Jump to Coordinates</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Latitude"
                  className="flex-1 min-w-[100px] border rounded-md p-2 bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  className="flex-1 min-w-[100px] border rounded-md p-2 bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary-foreground"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
                <Button
                  onClick={handleGoClick}
                  className="bg-primary text-primary-foreground px-4 min-w-[60px]"
                >
                  Go
                </Button>
              </div>
            </div>
          )}

          {/* Available Layers Section */}
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Available Layers</h2>
              {availableLayers.length > 0 ? (
                <div className="space-y-2">
                  {availableLayers.map((layer, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-input p-2 rounded-lg"
                    >
                      <span className="flex-grow font-medium truncate">
                        {layer}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
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
                            color={`${activeWMSLayer === layer
                                ? "green"
                                : "hsl(var(--foreground))"
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
                            color={`${activeSatelliteLayer === layer
                                ? "green"
                                : "hsl(var(--foreground))"
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
