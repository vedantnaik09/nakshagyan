// Map.tsx

"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import TileWMS from "ol/source/TileWMS";
import ImageStatic from "ol/source/ImageStatic";
import { transformExtent } from "ol/proj";
import "ol/ol.css";
import { PiRectangleDashed } from "react-icons/pi";
import { Sidebar } from "./Sidebar";
import {
  reducePrecision,
  epsg4326toEpsg3857,
  epsg3875toEpsg4326,
} from "../lib/utils";

import { applyONNXSegmentation, colorDictRgb } from "./model/Model";

// Import ShadCN UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Import GeoJSON Format and Vector Layers
import { GeoJSON } from "ol/format";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Fill, Stroke, Style } from "ol/style";

// Define the SegmentedImages type matching the model.ts callback
type SegmentedImages = {
  segmentedImage: string;
  masks: {
    water: string;
    land: string;
    vegetation: string;
    road: string;
    building: string;
  };
};

const Map: React.FC = () => {
  // Existing state variables
  const [wmsURL, setWMSURL] = useState<string>(
    `https://services.sentinel-hub.com/ogc/wms/${process.env.NEXT_PUBLIC_SENTINEL_INSTANCE_ID}?`
  );
  const [wmsLayer, setWMSLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const [satelliteLayer, setSatelliteLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const satelliteLayerRef = useRef<string>("1_TRUE-COLOR-L1C");
  const [layers, setLayers] = useState<string[]>([]);
  const [rectangleToolActive, setRectangleToolActive] = useState<boolean>(false);
  const [modalReload, setModalReload] = useState(false);

  // **New State Variable for Current Layer**
  const [currentLayer, setCurrentLayer] = useState<"water" | "vegetation" | "road" | "land" | "building" | "none" | "all">("none");

  // GeoServer Image Mosaic Layer details
  const geoServerWMSURL = `http://localhost:8080/geoserver/ne/wms`; // Base WMS URL
  const geoServerLayerName = `ne:tiff`; // Layer name
  const geoServerWMSVersion = `1.3.0`; // Updated to 1.3.0 for consistency
  const geoServerFormat = `image/png`; // Use 'image/png' for compatibility
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<OlMap | null>(null);

  // Custom selection state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPixel, setStartPixel] = useState<[number, number] | null>(null);
  const [currentPixel, setCurrentPixel] = useState<[number, number] | null>(null);
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);

  // New state variables for modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [selectedExtent, setSelectedExtent] = useState<[number, number, number, number] | null>(null);

  // Additional state for handling clicks and highlights
  const [highlightedClass, setHighlightedClass] = useState<number | null>(null);
  const [originalTileImage, setOriginalTileImage] = useState<string | null>(null);
  // State to track GeoServer layer visibility
  const [geoServerLayerVisible, setGeoServerLayerVisible] = useState<boolean>(true);
  const [currentImages, setCurrentImages] = useState<SegmentedImages>({
    segmentedImage: "",
    masks: {
      water: "",
      land: "",
      vegetation: "",
      road: "",
      building: "",
    },
  });

  // **New State for Mask Image Overlay**
  const [maskImage, setMaskImage] = useState<string | null>(null);

  // **New State for GeoJSON Data**
  const [geoJSONData, setGeoJSONData] = useState<GeoJSON.GeoJSON | null>(null); // Initialize without GeoJSON

  useEffect(() => {
    console.log(selectedImage);
  }, [selectedImage]);

  // Fetch WMS capabilities
  const fetchCapabilities = async (url: string) => {
    try {
      const response = await fetch(`${url}service=WMS&request=GetCapabilities`);
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

  // Set coordinates on the map
  const handleSetCoordinates = useCallback(
    (coordinates: { lat: number; lon: number }) => {
      if (mapObjRef.current) {
        const view = mapObjRef.current.getView();
        const transformedCoords = epsg4326toEpsg3857([
          coordinates.lat,
          coordinates.lon,
        ]);
        view.setCenter(transformedCoords);
      }
    },
    []
  );

  // Handle segmented image and masks
  const handleSegmentedImageReady = (images: SegmentedImages) => {
    const { segmentedImage, masks } = images;
    if (segmentedImage && masks.water) {
      // Set the captured image to selectedImage
      setSelectedImage(originalTileImage);

      // Store segmented images for later use
      setCurrentImages(images);
      setSelectedMask(masks.water);

      // Reset maskImage when a new segmentation is ready
      setMaskImage(null);

      // Open the modal
      setIsModalOpen(true);
    } else {
      console.error("No segmented image or mask found.");
    }
  };

  // **Handler Function to Change Layers**
  const onLayerChange = async (
    type: "water" | "vegetation" | "road" | "land" | "building" | "none" | "all"
  ) => {
    setCurrentLayer(type);

    const map = mapObjRef.current;
    if (!map) return;

    // Remove existing segmented layers
    const layersToRemove = map
      .getLayers()
      .getArray()
      .filter((layer) =>
        ["water", "vegetation", "road", "land", "building"].includes(
          layer.get("name")
        )
      );

    layersToRemove.forEach((layer) => map.removeLayer(layer));

    if (type === "none") {
      console.log("All segmented layers removed.");
      return;
    }

    try {
      // Fetch the GeoJSON data for the selected layer type
      console.log(type)
      const result = await fetchGeoJSON(type);

      console.log(`Adding layer for ${type}`);
      if (!geoJSONData) {
        console.log("No   geoJSONData")
      }
      addGeoJSONToMap(geoJSONData!);

      // Add a name property to the layer for later identification
      const mapLayers = map.getLayers().getArray();
      const addedLayer = mapLayers[mapLayers.length - 1];
      if (addedLayer instanceof VectorLayer) {
        addedLayer.set("name", `${type}Layer`);
      }
    } catch (error) {
      console.error(`Failed to fetch or add layer for ${type}:`, error);
    }
  };


  // **Handler Function to Set WMS URL**
  const handleSetWMSURL = (url: string) => {
    setWMSURL(url);
    const map = mapObjRef.current;
    if (map) {
      const sentinelWMSLayer = map
        .getLayers()
        .getArray()
        .find(
          (layerObj) => layerObj.get("name") === "sentinelWMSLayer"
        ) as TileLayer<TileWMS> | undefined;

      if (sentinelWMSLayer) {
        const source = sentinelWMSLayer.getSource();
        if (source) {
          source.setUrl(url);
          source.updateParams({}); // Force update
        }
      }
    }
  };
  // **Handler Functions for WMS and Satellite Layer Changes**
  const handleWMSLayerChange = (layer: string) => {
    setWMSLayer(layer);
    const map = mapObjRef.current;
    if (map) {
      const sentinelWMSLayer = map
        .getLayers()
        .getArray()
        .find(
          (layerObj) => layerObj.get("name") === "sentinelWMSLayer"
        ) as TileLayer<TileWMS> | undefined;

      if (sentinelWMSLayer) {
        sentinelWMSLayer.getSource()?.updateParams({ LAYERS: layer });
      }
    }
  };

  const handleSatelliteLayerChange = (layer: string) => {
    setSatelliteLayer(layer);
    satelliteLayerRef.current = layer;
    // Update satellite layer's layer name if needed
    // It depends on how satellite layers are managed
  };

  // **Handler Function to Toggle GeoServer Layer Visibility**
  const toggleGeoServerLayer = () => {
    const map = mapObjRef.current;
    if (!map) {
      console.error("Map not initialized");
      return;
    }

    const geoServerLayer = map
      .getLayers()
      .getArray()
      .find(
        (layer) => layer.get("name") === "geoServerImageMosaic"
      ) as TileLayer<TileWMS> | undefined;

    if (!geoServerLayer) {
      console.error("GeoServer Image Mosaic Layer not found.");
      // Log all current layers for debugging
      map.getLayers().getArray().forEach((layer, index) => {
        console.log(`Layer ${index}:`, layer.get("name"));
      });
      return;
    }

    const newVisibility = !geoServerLayer.getVisible();
    geoServerLayer.setVisible(newVisibility);
    setGeoServerLayerVisible(newVisibility);
    console.log(
      `GeoServer Image Mosaic Layer is now ${newVisibility ? "visible" : "hidden"
      }.`
    );
  };

  const fetchGeoJSON = async (filename: string,) => {
    try {
      const response = await fetch("/data/" + filename + ".geojson");
      console.log(response)
      if (!response.ok) throw new Error("Failed to fetch GeoJSON data.");
      const data: GeoJSON.GeoJSON = await response.json();
      console.log(data)
      setGeoJSONData(data);
      console.log("GeoJSON data loaded successfully.");
    } catch (error) {
      console.error("Error fetching GeoJSON:", error);
      toast.error("Failed to load GeoJSON data.", {
        theme: "dark",
        hideProgressBar: true,
        autoClose: 2000,
      });
    }
  };

  // Initialize map and fetch capabilities
  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize OpenLayers map
    const map = new OlMap({
      target: mapRef.current!,
      layers: [
        // Sentinel Hub WMS Layer
        new TileLayer({
          source: new TileWMS({
            url: wmsURL,
            params: {
              LAYERS: wmsLayer, // Initially "1_TRUE-COLOR-L1C"
              FORMAT: "image/png",
              TRANSPARENT: true,
              VERSION: "1.3.0",
            },
            serverType: "geoserver",
            crossOrigin: "anonymous", // Handle CORS if necessary
          }),
          properties: { name: "sentinelWMSLayer" }, // Assign a unique name
        }),
        // GeoServer Image Mosaic Layer
        new TileLayer({
          source: new TileWMS({
            url: geoServerWMSURL,
            params: {
              LAYERS: geoServerLayerName, // Ensure this matches your GeoServer layer
              FORMAT: geoServerFormat, // Typically "image/png"
              TRANSPARENT: true,
              VERSION: geoServerWMSVersion, // Typically "1.3.0"
            },
            serverType: "geoserver",
            crossOrigin: "anonymous", // Handle CORS if necessary
          }),
          opacity: 0.7, // Adjust opacity as needed
          visible: geoServerLayerVisible, // Control initial visibility
          zIndex: 1, // Ensure it's above the Sentinel layer
          properties: { name: "geoServerImageMosaic" }, // Assign a unique name
        }),
      ],
      view: new View({
        center: epsg4326toEpsg3857([55, 25]), // Dubai coordinates
        zoom: 10,
        minZoom: 0,
        maxZoom: 20,
        maxResolution: 200,
      }),
    });

    // Reference the map object
    mapObjRef.current = map;

    // Fetch capabilities for existing WMS URL
    if (wmsURL) {
      fetchCapabilities(wmsURL);
    }

    // **Fetch GeoJSON Data from Public Folder**
    // const fetchGeoJSON = async (filename: string, ) => {
    //   try {
    //     const response = await fetch("/data/" + filename + ".geojson");
    //     if (!response.ok) throw new Error("Failed to fetch GeoJSON data.");
    //     const data: GeoJSON.GeoJSON = await response.json();
    //     setGeoJSONData(data);
    //     console.log("GeoJSON data loaded successfully.");
    //   } catch (error) {
    //     console.error("Error fetching GeoJSON:", error);
    //     toast.error("Failed to load GeoJSON data.", {
    //       theme: "dark",
    //       hideProgressBar: true,
    //       autoClose: 2000,
    //     });
    //   }
    // };

    // fetchGeoJSON("water");

    return () => {
      map.setTarget(undefined);
    };
  }, [
    wmsURL,
    wmsLayer,
    geoServerWMSURL,
    geoServerLayerName,
    geoServerWMSVersion,
    geoServerFormat,
    geoServerLayerVisible,
  ]);

  // Toggle rectangle drawing tool
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

    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.display = "none";
    }

    const [x, y] = getRelativePosition(e);
    setCurrentPixel([x, y]);

    const dx = x - startPixel[0];
    const dy = y - startPixel[1];
    const side = Math.max(Math.abs(dx), Math.abs(dy));

    const left = dx < 0 ? startPixel[0] - side : startPixel[0];
    const top = dy < 0 ? startPixel[1] - side : startPixel[1];

    const map = mapObjRef.current;
    const rectTopLeft = map.getCoordinateFromPixel([left, top]);
    const rectBottomRight = map.getCoordinateFromPixel([left + side, top + side]);

    if (!rectTopLeft || !rectBottomRight) return;

    const [minX, maxY] = rectTopLeft;
    const [maxX, minY] = rectBottomRight;

    const transformedExtent = transformExtent(
      [minX, minY, maxX, maxY],
      "EPSG:3857",
      "EPSG:4326"
    );
    const [wMinX, wMinY, wMaxX, wMaxY] = transformedExtent;

    const topLeft = { lat: wMaxY, lon: wMinX };
    const bottomRight = { lat: wMinY, lon: wMaxX };

    // **Set the selectedExtent state**
    setSelectedExtent([wMinX, wMinY, wMaxX, wMaxY]);

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
    console.log(selectedImage);

    try {
      const response = await fetch(tileURL);
      if (!response.ok)
        throw new Error(`Failed to fetch tile image: ${response.statusText}`);

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);

      // Store the original tile image URL
      setOriginalTileImage(objectURL);

      const image = new Image();
      image.src = objectURL;
      image.onload = () => {
        console.log("Tile image loaded.");

        // Pass the folder name to applyONNXSegmentation
        applyONNXSegmentation(
          "/models/model.onnx",
          image,
          handleSegmentedImageReady,

          document.createElement("canvas"),
          topLeft,
          bottomRight
        );
      };
    } catch (error) {
      console.error("Error fetching tile:", error);
    }
  };

  // Function to highlight water bodies (existing functionality)
  const highlightWaterBodies = () => {
    if (!selectedMask || !selectedExtent) return;

    const img = new Image();
    img.src = selectedMask;
    img.crossOrigin = "Anonymous"; // Handle CORS if necessary
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Example: Assume water is represented by a specific color, e.g., blue (0, 0, 255)
      // Adjust the condition based on your mask's encoding for water
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Example condition: Water pixels are pure blue
        if (r === 0 && g === 0 && b === 255) {
          // Highlight water by changing color or adding transparency
          data[i + 2] = 255; // R
          data[i + 1] = 0;   // G
          data[i] = 0;       // B
          // data[i + 3] = 150; // Alpha
        } else {
          // Make non-water areas transparent
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const highlightedMaskURL = canvas.toDataURL("image/png");

      // **Overlay the Highlighted Mask on the Map**
      const map = mapObjRef.current;
      if (!map) return;

      // Remove existing highlight layer if any
      const existingHighlightLayer = map
        .getLayers()
        .getArray()
        .find((layer) => layer.get("name") === "highlight");
      if (existingHighlightLayer) {
        map.removeLayer(existingHighlightLayer);
      }

      // Create a new Image layer for the highlighted mask
      const imageLayer = new ImageLayer({
        source: new ImageStatic({
          url: highlightedMaskURL,
          projection: "EPSG:3857",
          imageExtent: transformExtent(
            selectedExtent,
            "EPSG:3857",
            "EPSG:3857"
          ), // Ensure consistency
        }),
        opacity: 0.6,
      });

      // Assign a name to the layer using the `set` method
      imageLayer.set("name", "highlight");

      // Add the layer to the map
      map.addLayer(imageLayer);
    };
  };

  // **Handler Function to Handle Image Clicks**
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!currentImages.segmentedImage) return;

    const img = e.currentTarget;

    // Get the natural (actual) dimensions
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Get the displayed dimensions
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;

    // Calculate scaling factors
    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    // Get click coordinates relative to the image
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Map to natural coordinates
    const pixelX = Math.floor(x * scaleX);
    const pixelY = Math.floor(y * scaleY);

    // Create a temporary canvas to get pixel data from the SEGMENTED image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = naturalWidth;
    tempCanvas.height = naturalHeight;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the SEGMENTED image onto the canvas
    const tempImage = new Image();
    tempImage.src = currentImages.segmentedImage;
    tempImage.crossOrigin = "Anonymous";
    tempImage.onload = () => {
      ctx.drawImage(tempImage, 0, 0, naturalWidth, naturalHeight);
      const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      const [r, g, b, a] = pixel;

      // Map the color to the class index based on colorDictRgb
      const classIndex = Object.keys(colorDictRgb).find(
        (key) =>
          colorDictRgb[key as keyof typeof colorDictRgb][0] === b &&
          colorDictRgb[key as keyof typeof colorDictRgb][1] === g &&
          colorDictRgb[key as keyof typeof colorDictRgb][2] === r
      );

      const classIdxToString: { [key: number]: keyof SegmentedImages["masks"] } = {
        1: "water",
        2: "land",
        3: "vegetation",
        4: "road",
        5: "building",
      };

      console.log(
        "Clicked on pixel with RGB:",
        r,
        g,
        b,
        "Class Index:",
        classIndex
      );

      // Only proceed if classIndex is found
      if (classIndex !== undefined) {
        const classKey = classIdxToString[Number(classIndex)];

        console.log(`Class Key: ${classKey}`);

        // Highlight features on the map based on the class
        highlightFeatures(Number(classIndex));

        setHighlightedClass(Number(classIndex));

        // Dynamically set the mask image based on the clicked class
        if (currentImages.masks[classKey]) {
          setMaskImage(currentImages.masks[classKey] as string);
        }
      } else {
        console.log("Clicked on an undefined class.");
      }

      // Reload the modal to reflect the changes
      setModalReload(false);
      setTimeout(() => {
        setModalReload(true);
      }, 10);
    };
  };

  // Function to highlight all features of a specific class
  const highlightFeatures = (classId: number) => {
    if (!selectedExtent) return;

    // Create a mask for the selected class
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = 1536; // Ensure this matches the tile size
    maskCanvas.height = 1536;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the segmented image onto the canvas
    const segmentedImage = new Image();
    segmentedImage.src = currentImages.segmentedImage!;
    segmentedImage.crossOrigin = "Anonymous";
    segmentedImage.onload = () => {
      ctx.drawImage(segmentedImage, 0, 0, maskCanvas.width, maskCanvas.height);
      const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;

      // Iterate through each pixel and highlight the selected class
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Compare with colorDictRgb to find the matching class
        let currentClassId: number | undefined = undefined;
        for (const [key, color] of Object.entries(colorDictRgb)) {
          if (
            color[0] === r &&
            color[1] === g &&
            color[2] === b
          ) {
            currentClassId = Number(key);
            break;
          }
        }

        if (currentClassId === classId) {
          // Highlight by setting a semi-transparent color (e.g., red)
          data[i + 0] = 255; // R
          data[i + 1] = 0;   // G
          data[i + 2] = 0;   // B
          data[i + 3] = 150; // Alpha
        } else {
          // Make other areas transparent
          data[i + 3] = 0;
        }
      }

      // Put the modified data back onto the canvas
      ctx.putImageData(imageData, 0, 0);
      const highlightedMaskURL = maskCanvas.toDataURL("image/png");

      // Overlay the highlighted mask on the map
      const map = mapObjRef.current;
      if (!map) return;

      // Remove existing highlight layer if any
      const existingHighlightLayer = map
        .getLayers()
        .getArray()
        .find((layer) => layer.get("name") === "highlight");
      if (existingHighlightLayer) {
        map.removeLayer(existingHighlightLayer);
      }

      // Create a new Image layer for the highlighted mask
      const imageLayer = new ImageLayer({
        source: new ImageStatic({
          url: highlightedMaskURL,
          projection: "EPSG:3857",
          imageExtent: transformExtent(
            selectedExtent,
            "EPSG:3857",
            "EPSG:3857"
          ), // Ensure consistency
        }),
        opacity: 0.6,
      });

      // Assign a name to the layer using the `set` method
      imageLayer.set("name", "highlight");

      // Add the layer to the map
      map.addLayer(imageLayer);
    };
  };

  // **Function to Add GeoJSON Layer to Map**
  const addGeoJSONToMap = (geojson: GeoJSON.GeoJSON) => {
    const map = mapObjRef.current;
    if (!map) {
      console.error("Map instance not available.");
      return;
    }


    // **Check if Layer Already Exists**
    const existingLayers = map.getLayers().getArray();

    existingLayers.forEach((layer) => {
      if (layer instanceof VectorLayer) {
        map.removeLayer(layer);
        console.log("Layer name:", layer.get("name"));
      }
    });


    // .find(
    //   (layer) => layer.get("name") === "geoJSONLayer"
    // ) as VectorLayer<VectorSource> | undefined;

    // console.log("Existing Layer:", existingLayer);
    // if (existingLayer!) {
    //   console.log("GeoJSON layer already exists on the map, will remove it and add another");
    //   // map.removeLayer(existingLayer);
    //   // return;
    // }
    console.log("Hello world");
    // **Create Vector Source from GeoJSON**
    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        featureProjection: "EPSG:3857", // Ensure projection matches the map's
      }),
    });

    // **Define Custom Style**
    const vectorStyle = new Style({
      fill: new Fill({
        color: "rgba(0, 128, 0, 0.5)", // Semi-transparent green
      }),
      stroke: new Stroke({
        color: "#008000", // Green border
        width: 2,
      }),
    });

    // **Create Vector Layer**
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: vectorStyle,
    });

    // Set the name property after creating the layer
    vectorLayer.set("name", "geoJSONLayer");

    // **Add Layer to Map**
    map.addLayer(vectorLayer);
    console.log("GeoJSON layer added to the map.");
  };
  // **Handler for "View in Map" Button**
  const handleViewInMap = (filename: string) => {
    if (!geoJSONData) {
      try {
        fetchGeoJSON(filename);
      }
      catch {
        console.error("No GeoJSON data available to add to the map.");
        toast.error("No GeoJSON data available.", {
          theme: "dark",
          hideProgressBar: true,
          autoClose: 2000,
        });
      }
      return;
    }

    addGeoJSONToMap(geoJSONData);
    toast.success("GeoJSON layer added to the map.", {
      theme: "dark",
      hideProgressBar: true,
      autoClose: 2000,
    });
  };

  return (
    <div className="flex h-full w-full">
      <Sidebar
        onLayerChange={onLayerChange} // Pass the handler directly
        currentLayer={currentLayer} // Pass the currentLayer state
        handleSetWMSURL={handleSetWMSURL} // Pass the handler
        availableLayers={layers}
        handleWMSLayerChange={handleWMSLayerChange}
        handleSatelliteLayerChange={handleSatelliteLayerChange}
        onSetCoordinates={handleSetCoordinates}
        handleToggleGeoServerLayer={toggleGeoServerLayer} // Pass the toggle function
        geoServerLayerVisible={geoServerLayerVisible} // Pass visibility state (optional)
      />
      <div className="w-full min-h-full relative">
        <button
          className={`absolute mx-auto my-2 top-2 left-0 right-0 w-fit p-2 z-10 rounded ${rectangleToolActive ? "bg-black" : "bg-black bg-opacity-50"
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
              position: "absolute",
              border: "2px dashed #4A90E2", // More visible color
              backgroundColor: "rgba(74, 144, 226, 0.2)", // Lighter, semi-transparent blue
              pointerEvents: "none",
              zIndex: 9999,
            }}
          ></div>
        </div>
        {/* ShadCN Modal Implementation */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent
            className="sm:max-w-3xl"
            key={modalReload ? "reload" : "no-reload"}
          >
            <DialogHeader>
              <DialogTitle>Selected Area</DialogTitle>
              <DialogDescription>
                Review the selected area and highlight specific features by clicking on them.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 relative">
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Captured Area"
                  className="w-full h-auto rounded cursor-pointer"
                  onClick={handleImageClick}
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                    cursor: "pointer",
                  }}
                />
              )}
              {maskImage && (
                <img
                  src={maskImage}
                  alt="Segmentation Mask"
                  className="absolute top-0 left-0 w-full h-full rounded pointer-events-none"
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                    mixBlendMode: "multiply", // Adjust blend mode as needed
                  }}
                />
              )}
              {/* Optional: Display selected class name */}
              {highlightedClass !== null && (
                <div className="absolute top-2 left-2 bg-white bg-opacity-75 p-2 rounded">
                  <span>Highlighted Class ID: {highlightedClass}</span>
                </div>
              )}
            </div>
            {/* <DialogFooter className="mt-4 flex justify-between">
              <Button
                variant="default"
                onClick={highlightWaterBodies}
                disabled={!selectedMask}
              >
                Highlight Water Bodies
              </Button>
              <div className="flex space-x-2">
                <Button variant="default" onClick={() => handleViewInMap("none")}>
                  View in Map
                </Button>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogFooter> */}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Map;
