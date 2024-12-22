import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as tf from "@tensorflow/tfjs";
import * as turf from 'turf';
import { isoLines } from 'marching-squares';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// export function epsg4326toEpsg3857(coordinates: number[]) {
//   let x = coordinates[0];
//   let y = coordinates[1];
//   x = (coordinates[0] * 20037508.34) / 180;
//   y = Math.log(Math.tan(((90 + coordinates[1]) * Math.PI) / 360)) / (Math.PI / 180);
//   y = (y * 20037508.34) / 180;
//   return [x, y];
// }

export function reducePrecision(
  coord: [number, number],
  precision: number = 5
): [number, number] {
  const factor = Math.pow(10, precision);
  return [
    Math.round(coord[0] * factor) / factor,
    Math.round(coord[1] * factor) / factor,
  ];
}

export function epsg4326toEpsg3857(coord: [number, number]) {
  const [lon, lat] = coord;

  // Validate the coordinates to ensure they are within the valid EPSG:4326 range
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    console.error("Invalid coordinates in EPSG:4326", coord);
    return [NaN, NaN]; // Return NaN if coordinates are invalid
  }
  // Conversion formula for EPSG:4326 to EPSG:3857
  const x = (lon * 20037508.34) / 180;
  const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  const yConverted = (y * 20037508.34) / 180;

  return [x, yConverted];
}

export function epsg3875toEpsg4326(coord: [number, number]) {
  const [x, y] = coord;

  // Conversion formulas for EPSG:3875 to EPSG:4326
  const lon = (x / 20037508.34) * 180;
  const lat = (y / 20037508.34) * 180;
  const latConverted =
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2) *
    (180 / Math.PI);

  return [lon, latConverted];
}

export const saveTensorToFile = (tensorData: any, fileName: string) => {
  const blob = new Blob(
    [tensorData.join("\n")], // Convert tensor data to a newline-separated string
    { type: "text/plain" }
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function createMaskTensor(
  tensor: tf.Tensor,
  targetClass: number,
  color: string,
  topLeft: { lat: number; lon: number },
  bottomRight: { lat: number; lon: number },
  title: string
): string {
  // Create a canvas to draw the image
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // saveTensorToFile(tensor.dataSync(), 'single class tensor')

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Get the tensor's shape, assuming it has a batch dimension
  const [batch, height, width] = tensor.shape;

  if (!height || !width) {
    throw new Error("Invalid tensor dimensions");
  }

  // Set canvas dimensions
  canvas.width = width;
  canvas.height = height;

  // Convert the tensor to a JavaScript array and remove the batch dimension
  const tensorArray = tensor.arraySync() as number[][][]; // 3D array
  const maskArray = tensorArray[0]; // Remove batch dimension

  const waterMask = maskArray.map((row) => row.map((value) => value === targetClass ? 1 : 0));
  saveGeoJSONToIndexedDB(waterMask, topLeft, bottomRight, title);

  // Iterate over the tensor and draw the target class with the specified color
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = maskArray[y][x]; // Access pixel value

      if (value === targetClass) {
        ctx.fillStyle = color; // Set color for the target class
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0)"; // Set default color
      }

      // Draw the pixel
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Convert the canvas content to a base64 image string
  return canvas.toDataURL();
}

// export function downloadGeoJSONFromMask(
//   mask: number[][],
//   topLeft: { lat: number; lon: number },
//   bottomRight: { lat: number; lon: number }
// ): void {
//   // Define the threshold for water detection
//   const threshold = [0.5];

//   // Generate isoLines from the mask
//   const lines = isoLines(mask, threshold);

//   // Convert isoLines output into GeoJSON polygons
//   const features = lines.flatMap((contours) =>
//     contours
//       .map((path: number[][]) => {
//         // Convert each path from mask coordinates to latitude/longitude
//         const latLonPath = path.map(([x, y]) => {
//           const lat =
//             topLeft.lat + (y / mask.length) * (bottomRight.lat - topLeft.lat);
//           const lon =
//             topLeft.lon + (x / mask[0].length) * (bottomRight.lon - topLeft.lon);
//           return [lon, lat]; // Ensure [lon, lat] order for GeoJSON
//         });

//         // Ensure the path is closed for GeoJSON polygons
//         if (
//           latLonPath.length > 0 &&
//           latLonPath[0][0] !== latLonPath[latLonPath.length - 1][0] &&
//           latLonPath[0][1] !== latLonPath[latLonPath.length - 1][1]
//         ) {
//           latLonPath.push(latLonPath[0]);
//         }

//         return turf.polygon([latLonPath]);
//       })
//       .filter((polygon) => {
//         // Check if the polygon spans the entire mask area
//         const bbox = turf.bbox(polygon); // Get the bounding box of the polygon
//         return !(
//           bbox[0] === topLeft.lon && // West
//           bbox[1] === bottomRight.lat && // South
//           bbox[2] === bottomRight.lon && // East
//           bbox[3] === topLeft.lat // North
//         );
//       })
//   );

//   const geoJSON = turf.featureCollection(features);

//   // Convert GeoJSON to a string
//   const geoJSONString = JSON.stringify(geoJSON, null, 2);

//   // Create a Blob and trigger download
//   const blob = new Blob([geoJSONString], { type: 'application/json' });
//   const url = URL.createObjectURL(blob);

//   const a = document.createElement('a');
//   a.href = url;
//   a.download = 'water_bodies.geojson';
//   a.click();

//   // Cleanup
//   URL.revokeObjectURL(url);
// }

export async function saveGeoJSONToIndexedDB(
  mask: number[][],
  topLeft: { lat: number; lon: number },
  bottomRight: { lat: number; lon: number },
  title: string
): Promise<void> {
  const height = mask.length;
  const width = mask[0].length;

  const features = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y][x] === 1) {
        // Approximate polygon around each cell
        const latTop = topLeft.lat + (y / height) * (bottomRight.lat - topLeft.lat);
        const lonLeft = topLeft.lon + (x / width) * (bottomRight.lon - topLeft.lon);
        const latBottom = topLeft.lat + ((y + 1) / height) * (bottomRight.lat - topLeft.lat);
        const lonRight = topLeft.lon + ((x + 1) / width) * (bottomRight.lon - topLeft.lon);

        const cellPolygon = turf.polygon([
          [
            [lonLeft, latTop],
            [lonRight, latTop],
            [lonRight, latBottom],
            [lonLeft, latBottom],
            [lonLeft, latTop],
          ],
        ]);
        features.push(cellPolygon);
      }
    }
  }

  const geoJSON = turf.featureCollection(features);
  const geoJSONString = JSON.stringify(geoJSON, null, 2);

  try {
    const dbName = "geojsonDB";
    const storeName = "geojsonStore";

    // Open a connection to the IndexedDB
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "title" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);

      // Save the GeoJSON data
      store.put({ title, geoJSON: geoJSONString });

      transaction.oncomplete = () => {
        console.log(`GeoJSON saved successfully in IndexedDB under title: "${title}"`);
      };

      transaction.onerror = (e) => {
        console.error("Error saving GeoJSON to IndexedDB:", e);
      };
    };

    request.onerror = (e) => {
      console.error("Error opening IndexedDB:", e);
    };
  } catch (error) {
    console.error("Error saving GeoJSON:", error);
  }
}




