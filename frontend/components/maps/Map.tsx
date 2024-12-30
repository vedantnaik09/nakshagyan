// Map.tsx
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { openDB } from "idb"; // Ensure idb is installed and imported
import { toast } from "react-toastify";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import TileWMS from "ol/source/TileWMS";
import ImageStatic from "ol/source/ImageStatic";
import { transformExtent, transform } from "ol/proj";
import "ol/ol.css";
import { PiRectangleDashed } from "react-icons/pi";
import { Sidebar } from "../Sidebar";
import { epsg4326toEpsg3857 } from "../../lib/utils";
import Loading from "@/components/Loading/Loading";

import { GeoJSON } from "ol/format";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Fill, Stroke, Style } from "ol/style";
import { applyONNXSegmentation, colorDictRgb } from "../model/Model";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadImagesForRun } from "@/lib/uploadImages";
import { Feature } from "ol";
import { Polygon } from "ol/geom";
import * as turf from "@turf/turf"; // For point-in-polygon checks

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
  const [isLoading, setIsLoading] = useState(false);
  const [wmsURL, setWMSURL] = useState<string>(`https://services.sentinel-hub.com/ogc/wms/${process.env.NEXT_PUBLIC_SENTINEL_INSTANCE_ID}?`);
  const [wmsLayer, setWMSLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const [satelliteLayer, setSatelliteLayer] = useState<string>("1_TRUE-COLOR-L1C");
  const satelliteLayerRef = useRef<string>("1_TRUE-COLOR-L1C");
  const [layers, setLayers] = useState<string[]>([]);
  const [rectangleToolActive, setRectangleToolActive] = useState<boolean>(false);
  const [modalReload, setModalReload] = useState(false);

  const [geoJSONData, setGeoJSONData] = useState<GeoJSON.GeoJSON | null>(null);
  const [currentLayer, setCurrentLayer] = useState<"water" | "vegetation" | "road" | "land" | "building" | "none" | "all">("none");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<OlMap | null>(null);

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPixel, setStartPixel] = useState<[number, number] | null>(null);
  const [currentPixel, setCurrentPixel] = useState<[number, number] | null>(null);
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedMask, setSelectedMask] = useState<string | null>(null);
  const [selectedExtent, setSelectedExtent] = useState<[number, number, number, number] | null>(null);

  const [highlightedClass, setHighlightedClass] = useState<number | null>(null);
  const [originalTileImage, setOriginalTileImage] = useState<string | null>(null);

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
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);

  // Store each class's GeoJSON data
  const [classGeoData, setClassGeoData] = useState<{
    [key: string]: GeoJSON.GeoJSON | null;
  }>({
    water: null,
    land: null,
    vegetation: null,
    road: null,
    building: null,
  });

  const classes = ["water", "land", "vegetation", "road", "building"] as const;

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!currentImages.segmentedImage) return;
    const img = e.currentTarget;

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pixelX = Math.floor(x * scaleX);
    const pixelY = Math.floor(y * scaleY);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = naturalWidth;
    tempCanvas.height = naturalHeight;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    const tempImage = new Image();
    tempImage.src = currentImages.segmentedImage;
    tempImage.crossOrigin = "Anonymous";
    tempImage.onload = () => {
      ctx.drawImage(tempImage, 0, 0, naturalWidth, naturalHeight);
      const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      const [r, g, b, a] = pixel;

      const classIndex = Object.keys(colorDictRgb).find(
        (key) =>
          colorDictRgb[key as keyof typeof colorDictRgb][0] === b &&
          colorDictRgb[key as keyof typeof colorDictRgb][1] === g &&
          colorDictRgb[key as keyof typeof colorDictRgb][2] === r
      );

      const classIdxToString: {
        [key: number]: keyof SegmentedImages["masks"];
      } = {
        0: "water",
        1: "land",
        2: "vegetation",
        3: "road",
        4: "building",
      };

      if (classIndex !== undefined) {
        const classKey = classIdxToString[Number(classIndex)];
        setHighlightedClass(Number(classIndex));
        if (currentImages.masks[classKey]) {
          setMaskImage(currentImages.masks[classKey] as string);
        }
        highlightFeatures(Number(classIndex));
      }
    };
  };

  const highlightFeatures = (classId: number) => {
    if (!selectedExtent || !currentImages.segmentedImage) return;

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = 1536;
    maskCanvas.height = 1536;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const segmentedImage = new Image();
    segmentedImage.src = currentImages.segmentedImage!;
    segmentedImage.crossOrigin = "Anonymous";
    segmentedImage.onload = () => {
      ctx.drawImage(segmentedImage, 0, 0, maskCanvas.width, maskCanvas.height);
      const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let currentClassId: number | undefined = undefined;
        for (const [key, color] of Object.entries(colorDictRgb)) {
          if (color[0] === r && color[1] === g && color[2] === b) {
            currentClassId = Number(key);
            break;
          }
        }

        if (currentClassId === classId) {
          data[i] = 255;
          data[i + 1] = 0;
          data[i + 2] = 0;
        } else {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const highlightedMaskURL = maskCanvas.toDataURL("image/png");

      const map = mapObjRef.current;
      if (!map) return;

      const existingHighlightLayer = map
        .getLayers()
        .getArray()
        .find((layer) => layer.get("name") === "highlight");
      if (existingHighlightLayer) {
        map.removeLayer(existingHighlightLayer);
      }

      const imageLayer = new ImageLayer({
        source: new ImageStatic({
          url: highlightedMaskURL,
          projection: "EPSG:3857",
          imageExtent: transformExtent(selectedExtent, "EPSG:4326", "EPSG:3857"),
        }),
        opacity: 0.6,
      });
      imageLayer.set("name", "highlight");
      map.addLayer(imageLayer);
    };
  };

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

  const handleSetCoordinates = useCallback((coordinates: { lat: number; lon: number }) => {
    if (mapObjRef.current) {
      const view = mapObjRef.current.getView();
      const transformedCoords = epsg4326toEpsg3857([coordinates.lat, coordinates.lon]);
      view.setCenter(transformedCoords);
    }
  }, []);

  const handleSegmentedImageReady = async (images: SegmentedImages) => {
    const { segmentedImage, masks } = images;
    if (segmentedImage && masks.water) {
      setCurrentImages(images);
      setSelectedMask(masks.water);
      setMaskImage(null);

      const tempImg = new Image();
      tempImg.src = segmentedImage;
      tempImg.onload = () => {
        if (selectedImageRef.current) {
          selectedImageRef.current.src = segmentedImage;
        }
        setIsModalOpen(true);
        setIsLoading(false);
      };
      tempImg.onerror = (err) => {
        console.error("Failed to load the segmented image:", err);
        setIsLoading(false);
        toast.error("Failed to load segmented image");
      };
    } else {
      console.error("No segmented image or mask found.");
      setIsLoading(false);
      toast.error("Segmentation failed");
    }
    try {
      // Open the IndexedDB database
      const db = await openDB("geojsonDB", 1);

      // Iterate over all classes and fetch GeoJSON data from IndexedDB
      for (const cls of classes) {
        if (!classGeoData[cls]) {
          try {
            // Open the IndexedDB database
            const db = await openDB("geojsonDB", 1);

            // Iterate over all classes and fetch GeoJSON data from IndexedDB
            for (const cls of classes) {
              if (!classGeoData[cls]) {
                try {
                  const data = await db.get("geojsonStore", cls);

                  if (data && data.geoJSON) {
                    console.log(cls, "Data is", data);

                    // Parse the geoJSON string into a JSON object
                    const parsedGeoJSON = JSON.parse(data.geoJSON);

                    // Use functional state update to correctly accumulate class data
                    setClassGeoData((prev) => ({
                      ...prev,
                      [cls]: parsedGeoJSON, // Store the parsed GeoJSON
                    }));
                    console.log("THe geojson data is ", classGeoData);
                  } else {
                    console.error(`GeoJSON data for class "${cls}" not found in IndexedDB.`);
                  }
                } catch (error) {
                  console.error(`Error loading GeoJSON data for class "${cls}":`, error);
                }
              }
            }
          } catch (error) {
            console.error("Error opening IndexedDB:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error opening IndexedDB:", error);
    }
  };

  const onLayerChange = async (type: "water" | "vegetation" | "road" | "land" | "building" | "none" | "all") => {
    setCurrentLayer(type);
    const map = mapObjRef.current;
    if (!map) return;

    const layersToRemove = map
      .getLayers()
      .getArray()
      .filter((layer) => ["water", "vegetation", "road", "land", "building"].includes(layer.get("name")));
    layersToRemove.forEach((layer) => map.removeLayer(layer));

    if (type === "none") {
      const existingLayers = map.getLayers().getArray();
      existingLayers.forEach((layer) => {
        if (layer instanceof VectorLayer && layer.get("name") === "geoJSONLayer") {
          map.removeLayer(layer);
        }
      });
    } else {
      try {
        await fetchGeoJSON(type);
        if (geoJSONData) {
          await addGeoJSONToMap(geoJSONData);
          const mapLayers = map.getLayers().getArray();
          const addedLayer = mapLayers[mapLayers.length - 1];
          if (addedLayer instanceof VectorLayer) {
            addedLayer.set("name", `geoJSONLayer`);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch or add layer for ${type}:`, error);
      }
    }
  };

  const handleSetWMSURL = (url: string) => {
    setWMSURL(url);
    const map = mapObjRef.current;
    if (map) {
      const sentinelWMSLayer = map
        .getLayers()
        .getArray()
        .find((layerObj) => layerObj.get("name") === "sentinelWMSLayer") as TileLayer<TileWMS> | undefined;

      if (sentinelWMSLayer) {
        const source = sentinelWMSLayer.getSource();
        if (source) {
          source.setUrl(url);
          source.updateParams({});
        }
      }
    }
  };

  const handleWMSLayerChange = (layer: string) => {
    setWMSLayer(layer);
    const map = mapObjRef.current;
    if (map) {
      const sentinelWMSLayer = map
        .getLayers()
        .getArray()
        .find((layerObj) => layerObj.get("name") === "sentinelWMSLayer") as TileLayer<TileWMS> | undefined;

      if (sentinelWMSLayer) {
        sentinelWMSLayer.getSource()?.updateParams({ LAYERS: layer });
      }
    }
  };

  const handleSatelliteLayerChange = (layer: string) => {
    setSatelliteLayer(layer);
    satelliteLayerRef.current = layer;
  };

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

  const getRelativePosition = (e: React.MouseEvent): [number, number] => {
    if (!mapRef.current) return [0, 0];
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return [x, y];
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!rectangleToolActive) return;
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

    const transformedExtent = transformExtent([minX, minY, maxX, maxY], "EPSG:3857", "EPSG:4326");
    const [wMinX, wMinY, wMaxX, wMaxY] = transformedExtent;
    const topLeft = { lat: wMaxY, lon: wMinX };
    const bottomRight = {
      lat: wMinY,
      lon: wMaxX,
    };

    setSelectedExtent([wMinX, wMinY, wMaxX, wMaxY]);

    const polygonCoordinates = [
      [
        [wMinX, wMaxY],
        [wMaxX, wMaxY],
        [wMaxX, wMinY],
        [wMinX, wMinY],
        [wMinX, wMaxY],
      ],
    ];
    const polygonFeature = new Feature({
      geometry: new Polygon(polygonCoordinates),
    });
    const polygonStyle = new Style({
      stroke: new Stroke({
        color: "rgba(255, 255, 0, 1)",
        width: 2,
      }),
      fill: new Fill({
        color: "rgba(255, 255, 0, 0.2)",
      }),
    });
    const polygonSource = new VectorSource({
      features: [polygonFeature],
    });
    const polygonLayer = new VectorLayer({
      source: polygonSource,
      style: polygonStyle,
      properties: { name: "selectionPolygon" },
    });

    const oldLayer = map
      .getLayers()
      .getArray()
      .find((l) => l.get("name") === "selectionPolygon");
    if (oldLayer) map.removeLayer(oldLayer);
    map.addLayer(polygonLayer);

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
    setIsLoading(true);

    try {
      const response = await fetch(tileURL);
      if (!response.ok) throw new Error(`Failed to fetch tile image: ${response.statusText}`);

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);

      setOriginalTileImage(objectURL);
      const folderName = `Run_${new Date().toISOString().replace(/[:.]/g, "_")}`;
      const tileBase64 = await blobToBase64(blob);
      await uploadImagesForRun(tileBase64, null, folderName, "tile.png");

      const image = new Image();
      image.src = objectURL;
      image.onload = () => {
        applyONNXSegmentation("/models/model.onnx", image, handleSegmentedImageReady, document.createElement("canvas"), folderName, topLeft, bottomRight);
      };
    } catch (error) {
      console.error("Error fetching tile:", error);
      setIsLoading(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const fetchGeoJSON = async (filename: string) => {
    try {
      const db = await openDB("geojsonDB", 1);
      const data = await db.get("geojsonStore", filename);

      if (!data) {
        throw new Error(`GeoJSON data for ${filename} not found in IndexedDB.`);
      }

      // Wait for the state to update before proceeding
      await setGeoJSONData(data.geoJSON);
    } catch (error) {
      console.error("Error fetching GeoJSON from IndexedDB:", error);
      toast.error("Failed to load GeoJSON data from IndexedDB.", {
        theme: "dark",
        hideProgressBar: true,
        autoClose: 2000,
      });
    }
  };

  // Trigger layer update when geoJSONData changes
  useEffect(() => {
    if (geoJSONData) {
      addGeoJSONToMap(geoJSONData);
    }
  }, [geoJSONData]);

  const addGeoJSONToMap = async (geojson: GeoJSON.GeoJSON) => {
    const map = mapObjRef.current;
    if (!map) {
      console.error("Map instance not available.");
      return;
    }

    const existingLayers = map.getLayers().getArray();
    console.log("Existing layers are ", existingLayers);
    existingLayers.forEach((layer) => {
      if (layer instanceof VectorLayer && layer.get("name") === "geoJSONLayer") {
        map.removeLayer(layer);
      }
    });

    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        featureProjection: "EPSG:3857",
      }),
    });

    const vectorStyle = new Style({
      fill: new Fill({
        color: "rgba(0, 128, 0, 0.5)",
      }),
      stroke: new Stroke({
        color: "#008000",
        width: 2,
      }),
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: vectorStyle,
    });
    vectorLayer.set("name", "geoJSONLayer");
    await map.addLayer(vectorLayer);
  };

  useEffect(() => {
    if (!mapRef.current) return;
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
            crossOrigin: "anonymous",
          }),
          properties: {
            name: "sentinelWMSLayer",
          },
        }),
      ],
      view: new View({
        center: epsg4326toEpsg3857([54.535945918788734, 24.52904002695162]),
        zoom: 3,
        minZoom: 0,
        maxZoom: 20,
        maxResolution: 200,
      }),
    });

    mapObjRef.current = map;

    if (wmsURL) {
      fetchCapabilities(wmsURL);
    }

    return () => {
      map.setTarget(undefined);
    };
  }, [wmsURL, wmsLayer]);

  // On map click - check which polygon the point falls into
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

    const handleMapClick = async (evt: any) => {
      setIsLoading(true);

      const coordinate4326 = transform(evt.coordinate, "EPSG:3857", "EPSG:4326");
      if (!coordinate4326) {
        setIsLoading(false);
        return;
      }

      const point = turf.point(coordinate4326);
      let foundFeatureClass: string | null = null;
      let foundFeature: GeoJSON.Feature<GeoJSON.Geometry> | null = null;

      // Check each class's geojson to see if point is inside
      for (const cls of classes) {
        const geoData = classGeoData[cls];
        if (!geoData) continue;

        if (geoData.type === "FeatureCollection") {
          for (const feature of geoData.features) {
            if (feature.geometry && booleanPointInPolygon(point, feature as any)) {
              foundFeatureClass = cls;
              foundFeature = feature;
              break;
            }
          }
        }

        if (foundFeatureClass) break;
      }

      if (foundFeature && foundFeatureClass) {
        // Plot the entire class's GeoJSON on the map
        const classData = classGeoData[foundFeatureClass];
        if (classData) {
          addGeoJSONToMap(classData);
        }

        highlightPolygonFeature(foundFeature);
        toast.success(`Clicked inside a ${foundFeatureClass} polygon!`, {
          theme: "dark",
          hideProgressBar: true,
          autoClose: 2000,
        });
      } else {
        toast.info("Clicked outside known polygons.", {
          theme: "dark",
          hideProgressBar: true,
          autoClose: 2000,
        });
      }

      setIsLoading(false);
    };

    map.on("singleclick", handleMapClick);

    return () => {
      map.un("singleclick", handleMapClick);
    };
  }, [classGeoData, selectedExtent, currentImages]);

  const highlightPolygonFeature = (feature: GeoJSON.Feature<GeoJSON.Geometry>) => {
    const map = mapObjRef.current;
    if (!map) return;

    // Remove old highlight polygon layer if exists
    const oldLayer = map
      .getLayers()
      .getArray()
      .find((l) => l.get("name") === "polygonHighlight");
    if (oldLayer) map.removeLayer(oldLayer);

    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(feature, {
        featureProjection: "EPSG:3857",
      }),
    });

    const highlightStyle = new Style({
      stroke: new Stroke({
        color: "rgba(255,0,0,1)",
        width: 3,
      }),
      fill: new Fill({
        color: "rgba(255,0,0,0.2)",
      }),
    });

    const highlightLayer = new VectorLayer({
      source: vectorSource,
      style: highlightStyle,
      properties: { name: "polygonHighlight" },
    });

    map.addLayer(highlightLayer);
  };

  return (
    <div className="flex h-full w-full">
      {isLoading && <Loading />}
      <Sidebar
        onLayerChange={onLayerChange}
        currentLayer={currentLayer}
        handleSetWMSURL={handleSetWMSURL}
        availableLayers={layers}
        handleWMSLayerChange={handleWMSLayerChange}
        handleSatelliteLayerChange={handleSatelliteLayerChange}
        onSetCoordinates={handleSetCoordinates}
      />
      <div className="w-full min-h-full relative">
        <button
          className={`absolute mx-auto my-2 top-2 left-0 right-0 w-fit p-2 z-10 rounded ${rectangleToolActive ? "bg-black " : "bg-black bg-opacity-50"}`}
          onClick={toggleRectangleTool}
        >
          <PiRectangleDashed size={22} />
        </button>
        <div ref={mapRef} className="w-full h-full" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} style={{ position: "relative" }}>
          <div
            ref={selectionBoxRef}
            style={{
              display: "none",
              position: "absolute",
              border: "2px dashed #4A90E2",
              backgroundColor: "rgba(74, 144, 226, 0.2)",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          ></div>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-3xl max-h-screen overflow-auto" key={modalReload ? "reload" : "no-reload"}>
            <DialogHeader className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
              <div>
                <DialogTitle>Selected Area</DialogTitle>
                <DialogDescription>Review the selected area and highlight specific features by clicking on them.</DialogDescription>
              </div>
              <div className="mt-4 sm:mt-0 w-full sm:w-auto">
                <label htmlFor="layer-select" className="block text-sm font-medium text-gray-700">
                  Select Layer:
                </label>
                <select
                  id="layer-select"
                  className="mt-1 block w-full sm:w-48 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={currentLayer}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCurrentLayer(selected as "water" | "vegetation" | "road" | "land" | "building" | "none" | "all");
                    setMaskImage(selected === "all" ? currentImages.segmentedImage : currentImages.masks[selected as keyof typeof currentImages.masks]);
                  }}
                >
                  <option value="none">None</option>
                  <option value="water">Water</option>
                  <option value="land">Land</option>
                  <option value="vegetation">Vegetation</option>
                  <option value="road">Road</option>
                  <option value="building">Building</option>
                  <option value="all">All Layers</option>
                </select>
              </div>
            </DialogHeader>
            <div className="mt-4 relative h-[100%] flex items-center justify-center">
              {maskImage && (
                <img
                  src={maskImage}
                  alt="Segmentation Mask"
                  className="absolute w-[70%] rounded pointer-events-none z-30"
                  style={{
                    display: "block",
                    mixBlendMode: "multiply",
                  }}
                />
              )}
              {originalTileImage && (
                <img
                  src={originalTileImage}
                  alt="Original Tile Image"
                  className="absolute w-[70%] rounded z-20 pointer-events-none"
                  style={{
                    display: "block",
                  }}
                />
              )}
              {isModalOpen && (
                <img
                  ref={selectedImageRef}
                  src={currentImages.segmentedImage}
                  alt="Captured Area"
                  className="w-[70%] rounded cursor-pointer z-10"
                  onClick={handleImageClick}
                  style={{
                    display: "block",
                    cursor: "pointer",
                  }}
                />
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Map;
