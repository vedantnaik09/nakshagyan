"use client";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { DragBox } from "ol/interaction";
import { platformModifierKeyOnly } from "ol/events/condition";
import "ol/ol.css";
import { PiRectangleDashed } from "react-icons/pi";
import { Sidebar } from "./Sidebar";
import {
  reducePrecision,
  epsg4326toEpsg3857,
  epsg3875toEpsg4326,
} from "../lib/utils";

import { applyONNXSegmentation } from "./model/Model";

const Map: React.FC = () => {
  const [wmsURL, setWMSURL] = useState<string>(
    `https://services.sentinel-hub.com/ogc/wms/${process.env.NEXT_PUBLIC_SENTINEL_INSTANCE_ID}`
  );
  const [wmsLayer, setWMSLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const [satelliteLayer, setSatelliteLayer] =
    useState<string>("1_TRUE-COLOR-L1C");
  const satelliteLayerRef = useRef<string>("1_TRUE-COLOR-L1C");
  const [layers, setLayers] = useState<string[]>([]);
  const [rectangleToolActive, setRectangleToolActive] =
    useState<boolean>(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);
  const [segmentedImage, setSegmentedImage] = useState<string | null>(null);

  const fetchCapabilities = async (url: string) => {
    try {
      const response = await fetch(
        `${url}?SERVICE=WMS&REQUEST=GetCapabilities`
      );
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const layerElements = xmlDoc.getElementsByTagName("Layer");
      const layerNames: string[] = [];

      for (let i = 0; i < layerElements.length; i++) {
        const nameElement = layerElements[i].getElementsByTagName("Name")[0];
        if (nameElement) {
          layerNames.push(nameElement.textContent || "");
        }
      }

      setLayers(layerNames);
    } catch (error) {
      console.error("Failed to fetch capabilities:", error);
    }
  };

  const handleSegmentedImageReady = (segmentedImage: string) => {
    if (segmentedImage) {
      const link = document.createElement("a");
      link.href = segmentedImage;
      const uniqueFilename = `segmented_mask_${Date.now()}.png`;
      link.download = uniqueFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`segmented_image.png saved successfully.`);
    } else {
      console.error("No segmented image found.");
    }
  };

  useEffect(() => {
    if (wmsURL) {
      fetchCapabilities(wmsURL);
    }
  }, [wmsURL]);

  useEffect(() => {
    satelliteLayerRef.current = satelliteLayer; // Update ref whenever satelliteLayer changes
    console.log("Satellite Layer updated:", satelliteLayer);
  }, [satelliteLayer]);

  useEffect(() => {
    if (!mapRef.current) return;

    const maxResolution = 200;

    // Initialize OpenLayers map
    const map = new OlMap({
      target: mapRef.current!,
      layers: [
        new TileLayer({
          source: new TileWMS({
            url: wmsURL,
            params: {
              LAYERS: wmsLayer,
              FORMAT: "image/png",
              TRANSPARENT: true,
              VERSION: "1.3.0",
            },
            serverType: "geoserver",
          }),
        }),
      ],
      view: new View({
        center: epsg4326toEpsg3857([122, 37]), // Initial center of the map
        zoom: 1, // Start with a zoom level under 200 m/pixel
        minZoom: 0, // Minimum zoom level
        maxZoom: 200, // Maximum zoom level
        maxResolution: maxResolution, // Limit resolution to below 200 m/pixel
      }),
    });

    map.getView().on("change:resolution", () => {
      const resolution = map.getView().getResolution();
    });

    const dragBox = new DragBox({
      condition: platformModifierKeyOnly,
    });
    dragBoxRef.current = dragBox;

    dragBox.on("boxend", async () => {
      const boxExtent = dragBox.getGeometry().getExtent();

      const projection = map.getView().getProjection(); // Get map projection

      // Check if the bounding box is already in EPSG:3857 or EPSG:3875
      const isEpsg3875 = projection.getCode() === "EPSG:3875";
      const isEpsg3857 = projection.getCode() === "EPSG:3857";

      const [minX, minY, maxX, maxY] = boxExtent;
      // Declare minXY and maxXY as tuples
      let minXY: any, maxXY: any;

      if (isEpsg3875) {
        // Convert from EPSG:3875 to EPSG:4326
        minXY = epsg3875toEpsg4326([minX, minY]);
        maxXY = epsg3875toEpsg4326([maxX, maxY]);
      } else if (isEpsg3857) {
        // If already in EPSG:3857, use as-is
        minXY = [minX, minY];
        maxXY = [maxX, maxY];
      } else {
        // If in EPSG:4326, convert to EPSG:3857
        minXY = epsg4326toEpsg3857([minX, minY]);
        maxXY = epsg4326toEpsg3857([maxX, maxY]);
      }

      const minXYReduced = reducePrecision(minXY);
      const maxXYReduced = reducePrecision(maxXY);
      // Check if any of the coordinates are invalid (NaN)
      if (
        isNaN(minXYReduced[0]) ||
        isNaN(minXYReduced[1]) ||
        isNaN(maxXYReduced[0]) ||
        isNaN(maxXYReduced[1])
      ) {
        console.error(
          "Invalid coordinates after conversion. Skipping WMS request."
        );
        return; // Skip the WMS request if coordinates are invalid
      }

      // Prepare the WMS request
      const width = 512;
      const height = 512;

      const params = new URLSearchParams({
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetMap",
        LAYERS: satelliteLayerRef.current, // Use the ref for the current layer
        STYLES: "",
        BBOX: `${minXYReduced[0]},${minXYReduced[1]},${maxXYReduced[0]},${maxXYReduced[1]}`, // Correct BBOX in EPSG:3857
        WIDTH: width.toString(),
        HEIGHT: height.toString(),
        CRS: "EPSG:3857", // Ensure correct CRS
        FORMAT: "image/png",
        TRANSPARENT: "true",
      });

      const tileURL = `${wmsURL}?${params.toString()}`;

      try {
        const response = await fetch(tileURL);
        if (!response.ok) {
          throw new Error(`Failed to fetch tile image: ${response.statusText}`);
        }

        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);

        const image = new Image();
        image.src = objectURL;
        image.onload = () => {
          // When the image is loaded, trigger segmentation
          console.log("Tile image loaded.");
          applyONNXSegmentation(
            "/models/39epochs_g.onnx",
            image,
            handleSegmentedImageReady,
            document.createElement("canvas")
          );
        };

        // Pass the image object to the segmentation component once it's loaded
        return image;
      } catch (error) {
        console.error("Error fetching tile:", error);
      }
    });

    dragBox.on("boxstart", () => {
      console.log("Drawing a new rectangle...");
    });

    map.addInteraction(dragBox);
    dragBox.setActive(false);

    return () => {
      map.setTarget(undefined);
    };
  }, [wmsURL, wmsLayer]);

  const toggleRectangleTool = () => {
    if (dragBoxRef.current) {
      const isActive = !rectangleToolActive;
      dragBoxRef.current.setActive(isActive);
      setRectangleToolActive(isActive);
    }
    if (!rectangleToolActive) {
      toast.success("Use Ctrl+Drag to select an area", {
        theme: "dark",
        icon: false,
        hideProgressBar: true,
        autoClose: 1500,
      });
    }
  };

  const handleWMSLayerChange = (layer: string) => {
    window.alert(`Setting WMS layer to: ${layer}`);
    setWMSLayer(layer);
  };

  const handleSatelliteLayerChange = (layer: string) => {
    window.alert(`Setting Satellite layer to: ${layer}`);
    setSatelliteLayer(layer);
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar
        onLayerChange={(type) => console.log(`Layer changed to: ${type}`)}
        currentLayer="none"
        handleSetWMSURL={(url: string) => {
          window.alert(`Setting WMS URL to: ${url}`);
          setWMSURL(url);
        }}
        availableLayers={layers}
        handleWMSLayerChange={handleWMSLayerChange}
        handleSatelliteLayerChange={handleSatelliteLayerChange}
      />
      <div className="w-full min-h-full relative">
        <button
          className={`absolute mx-auto my-2 top-2 left-0 right-0 w-fit p-2 z-10 rounded ${
            rectangleToolActive ? "bg-black " : "bg-black bg-opacity-50"
          }`}
          onClick={toggleRectangleTool}
        >
          <PiRectangleDashed size={22} />
        </button>
        <div ref={mapRef} className="w-full h-full"></div>
      </div>
    </div>
  );
};

export default Map;
