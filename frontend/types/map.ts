import { type Map } from "@maptiler/sdk";
import { type MutableRefObject } from "react";

export type MapRef = MutableRefObject<Map | null>;

export type LayerType = "water" | "vegetation" | "road"| "land"| "building" | "none" | "all";

export interface Coordinates {
  x: number;
  y: number;
}