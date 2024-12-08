import React, { useEffect, useRef } from "react";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";

interface WMSMapProps {
  wmsURL: string; // The URL of the WMS service
  layers: string; // Layers to request from the WMS service
  format?: string; // Format of the WMS images (default: 'image/png')
  transparent?: boolean; // Whether the WMS layer is transparent (default: true)
  center?: [number, number]; // Initial center of the map in longitude/latitude (default: [0, 0])
  zoom?: number; // Initial zoom level of the map (default: 2)
}

const WMSMap: React.FC<WMSMapProps> = ({
  wmsURL,
  layers,
  format = "image/png",
  transparent = true,
  center = [0, 0],
  zoom = 2,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return; // Ensure the ref is not null

    const map = new OlMap({
      target: mapRef.current!,
      layers: [
        new TileLayer({
          source: new TileWMS({
            url: wmsURL,
            params: {
              LAYERS: layers,
              FORMAT: format,
              TRANSPARENT: transparent,
            },
            serverType: "geoserver", // Adjust based on your WMS server
          }),
        }),
      ],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
      }),
    });

    return () => {
      map.setTarget(undefined); // Cleanup to prevent memory leaks
    };
  }, [wmsURL, layers, format, transparent, center, zoom]);

  return <div ref={mapRef} className="w-full h-full" />;
};

export default WMSMap;
