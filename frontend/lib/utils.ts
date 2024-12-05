import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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