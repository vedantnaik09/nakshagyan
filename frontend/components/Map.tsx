import React, { useEffect, useRef } from 'react';
import { Map as OlMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import TileWMS from 'ol/source/TileWMS';
import 'ol/ol.css';

import { Sidebar } from './Sidebar';

const Map: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return; // Ensure the ref is not null

    const map = new OlMap({
      target: mapRef.current!, // Non-null assertion operator ensures this is not null
      layers: [
        new TileLayer({
          source: new TileWMS({
            url: 'https://ows.terrestris.de/osm/service?', // Free aerial WMS from OpenStreetMap
            params: {
              LAYERS: 'OSM-WMS',
              FORMAT: 'image/png',
              TRANSPARENT: true,
            },
            serverType: 'geoserver',
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    return () => {
      map.setTarget(undefined); // Cleanup to prevent memory leaks
    };
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar
        onLayerChange={(type) => console.log(`Layer changed to: ${type}`)}
        currentLayer="none"
      />
      <div ref={mapRef} className="w-full h-full"></div>
    </div>
  );
};

export default Map;
