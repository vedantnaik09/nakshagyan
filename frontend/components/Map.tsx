import React, { useEffect, useRef, useState } from "react";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import TileWMS from "ol/source/TileWMS";
import "ol/ol.css";

import { Sidebar } from "./Sidebar";

const Map: React.FC = () => {
  const [wmsURL, setWMSURL] = useState<string>(
    "https://ows.terrestris.de/osm/service?"
  );
  const [wmsLayer, setWMSLayer] = useState<string>("OSM-WMS");
  const [layers, setLayers] = useState<string[]>([]); 
  const mapRef = useRef<HTMLDivElement | null>(null);

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

    return () => {
      map.setTarget(undefined);
    };
  }, [wmsURL, wmsLayer]);

  const handleWMSLayerChange = (layer: string) => { 
    window.alert(`Setting WMS layer to: ${layer}`);
    setWMSLayer(layer);
  }

  return (
    <div className="flex h-screen">
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
      <div ref={mapRef} className="w-3/4 h-full"></div>
    </div>
  );
};

export default Map;
