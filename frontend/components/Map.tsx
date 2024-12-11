"use client";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { transformExtent } from "ol/proj";
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
    `https://services.sentinel-hub.com/ogc/wms/${process.env.NEXT_PUBLIC_SENTINEL_INSTANCE_ID}?`
  );
  const [wmsLayer, setWMSLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const [satelliteLayer, setSatelliteLayer] =
    useState<string>("1_TRUE-COLOR-L1C");
  const satelliteLayerRef = useRef<string>("1_TRUE-COLOR-L1C");
  const [layers, setLayers] = useState<string[]>([]);
  const [rectangleToolActive, setRectangleToolActive] =
    useState<boolean>(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<OlMap | null>(null);

  // For custom selection
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPixel, setStartPixel] = useState<[number, number] | null>(null);
  const [currentPixel, setCurrentPixel] = useState<[number, number] | null>(
    null
  );

  const selectionBoxRef = useRef<HTMLDivElement | null>(null);

  const fetchCapabilities = async (url: string) => {
    try {
      const response = await fetch(
        `${url}service=WMS&request=GetCapabilities`
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
    satelliteLayerRef.current = satelliteLayer;
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

    mapObjRef.current = map;

    return () => {
      map.setTarget(undefined);
    };
  }, [wmsURL, wmsLayer]);

  const toggleRectangleTool = () => {
    const newState = !rectangleToolActive;
    setRectangleToolActive(newState);
    if (newState) {
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

  // Utility function to get mouse position relative to the map container
  const getRelativePosition = (e: React.MouseEvent): [number, number] => {
    if (!mapRef.current) return [0, 0];
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return [x, y];
  };

  // Mouse event handlers for custom box
  const onMouseDown = (e: React.MouseEvent) => {
    if (!rectangleToolActive) return;

    // Require ctrl key if desired (similar to platformModifierKeyOnly)
    if (!e.ctrlKey) return;

    setIsDrawing(true);
    const [x, y] = getRelativePosition(e);
    setStartPixel([x, y]);
    setCurrentPixel([x, y]);

    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.display = "block";
      selectionBoxRef.current.style.left = `${x}px`;
      selectionBoxRef.current.style.top = `${y}px`;
      selectionBoxRef.current.style.width = `0px`;
      selectionBoxRef.current.style.height = `0px`;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPixel) return;
    const [x, y] = getRelativePosition(e);
    setCurrentPixel([x, y]);

    const dx = x - startPixel[0];
    const dy = y - startPixel[1];
    const side = Math.max(Math.abs(dx), Math.abs(dy));

    // Determine top-left corner for the square
    const left = dx < 0 ? startPixel[0] - side : startPixel[0];
    const top = dy < 0 ? startPixel[1] - side : startPixel[1];

    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.left = `${left}px`;
      selectionBoxRef.current.style.top = `${top}px`;
      selectionBoxRef.current.style.width = `${side}px`;
      selectionBoxRef.current.style.height = `${side}px`;
    }
  };

  const onMouseUp = async (e: React.MouseEvent) => {
    if (!isDrawing || !startPixel || !mapObjRef.current) return;
    setIsDrawing(false);

    const [x, y] = getRelativePosition(e);
    setCurrentPixel([x, y]);

    const dx = x - startPixel[0];
    const dy = y - startPixel[1];
    const side = Math.max(Math.abs(dx), Math.abs(dy));

    const left = dx < 0 ? startPixel[0] - side : startPixel[0];
    const top = dy < 0 ? startPixel[1] - side : startPixel[1];

    // Convert screen (pixel) coordinates to map coordinates
    const map = mapObjRef.current;
    const rectTopLeft = map.getCoordinateFromPixel([left, top]);
    const rectBottomRight = map.getCoordinateFromPixel([
      left + side,
      top + side,
    ]);

    if (!rectTopLeft || !rectBottomRight) {
      if (selectionBoxRef.current) {
        selectionBoxRef.current.style.display = "none";
      }
      return;
    }

    const [minX, maxY] = rectTopLeft; // top-left
    const [maxX, minY] = rectBottomRight; // bottom-right

    // Transform to EPSG:4326 (if map is in EPSG:3857)
    const transformedExtent = transformExtent(
      [minX, minY, maxX, maxY],
      "EPSG:3857",
      "EPSG:4326"
    );
    const [wMinX, wMinY, wMaxX, wMaxY] = transformedExtent;

    const width = 1536;
    const height = 1536;

    const params = new URLSearchParams({
      service: "WMS",
      version: "1.1.1",
      request: "GetMap",
      layers: satelliteLayerRef.current,
      styles: "",
      bbox: `${wMinX},${wMinY},${wMaxX},${wMaxY}`,
      width: width.toString(),
      height: height.toString(),
      srs: "EPSG:4326",
      format: "image/png",
      transparent: "true",
    });

    const tileURL = `${wmsURL}&${params.toString()}`;
    console.log("Fetching tile from:", tileURL);

    try {
      const response = await fetch(tileURL);
      if (!response.ok)
        throw new Error(`Failed to fetch tile image: ${response.statusText}`);

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectURL;
      link.download = "tile.png";
      link.click();

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

    // Hide the selection box
    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.display = "none";
    }
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
        <div
          ref={mapRef}
          className="w-full h-full"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          style={{ position: "relative" }} // Ensure map container is positioned relative
        >
          {/* Selection Box */}
          <div
            ref={selectionBoxRef}
            style={{
              display: "none",
              position: "absolute", // Change from fixed to absolute
              border: "2px dashed #000",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Map;
