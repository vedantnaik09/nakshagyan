import React, { useEffect, useRef, useState } from "react";
import { toast } from 'react-toastify';
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import TileWMS from "ol/source/TileWMS";
import { DragBox } from "ol/interaction";
import { platformModifierKeyOnly } from "ol/events/condition";
import { transformExtent } from "ol/proj";
import "ol/ol.css";
import { PiRectangleDashed } from "react-icons/pi";

import { Sidebar } from "./Sidebar";

const Map: React.FC = () => {
  const [wmsURL, setWMSURL] = useState<string>(
    "https://ows.terrestris.de/osm/service?"
  );
  const [wmsLayer, setWMSLayer] = useState<string>("OSM-WMS");
  const [layers, setLayers] = useState<string[]>([]);
  const [rectangleToolActive, setRectangleToolActive] = useState<boolean>(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragBoxRef = useRef<DragBox | null>(null);

  const fetchCapabilities = async (url: string) => {
    try {
      const response = await fetch(
        `${url}?service=WMS&request=GetCapabilities`
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

  useEffect(() => {
    if (wmsURL) {
      fetchCapabilities(wmsURL);
    }
  }, [wmsURL]);

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
            },
            serverType: "geoserver",
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    // Initialize DragBox interaction
    const dragBox = new DragBox({
      condition: platformModifierKeyOnly,
    });
    dragBoxRef.current = dragBox;

    dragBox.on("boxend", () => {
      const boxExtent = dragBox.getGeometry().getExtent();

      // Transform from EPSG:3857 to EPSG:4326
      const transformedExtent = transformExtent(
        boxExtent,
        "EPSG:3857",
        "EPSG:4326"
      );

      console.log("Rectangle coordinates (lat/lon):", transformedExtent);
    });

    dragBox.on("boxstart", () => {
      console.log("Drawing a new rectangle...");
    });

    map.addInteraction(dragBox);
    dragBox.setActive(false); // Start with the tool disabled

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
    if(!rectangleToolActive){
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
      />
      <div className="w-full min-h-full relative">
        <button
          className={`absolute mx-auto my-2 top-2 left-0 right-0 w-fit p-2 z-10 rounded ${
            rectangleToolActive ? "bg-black " : "bg-black bg-opacity-50"
          }`}
          onClick={toggleRectangleTool}
        >
          <PiRectangleDashed size={22}/>
        </button>
        <div ref={mapRef} className="w-full h-full"></div>
      </div>
    </div>
  );
};

export default Map;
