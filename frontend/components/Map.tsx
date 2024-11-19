"use client";

import React, { useRef, useEffect, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { MapControls } from "@/components/MapControls";
import { cn } from "@/lib/utils";
import { Square } from "lucide-react";
import * as tf from "@tensorflow/tfjs"; // Import TensorFlow.js

const MAPTILER_API_KEY = "vMUChi7LxgWHU4DOJoFH";
const MODEL_URL = "/models/model.json"; // TensorFlow.js model path in public/models
const TEST_IMAGE_URL = "/image.png"; // Path to your test image in the public folder

export default function Map() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [rectangleActive, setRectangleActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCoords, setStartCoords] = useState({ x: 0, y: 0 });
  const [endCoords, setEndCoords] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false); // Added state for button loading
  const [model, setModel] = useState<tf.GraphModel | null>(null); // Store loaded model

  // Load the TensorFlow.js model
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Loading model...");
        const loadedModel = await tf.loadGraphModel(MODEL_URL);
        console.log("Model loaded successfully:", loadedModel);
        setModel(loadedModel);
      } catch (error) {
        console.error("Error loading TensorFlow model:", error);
      }
    };
    loadModel();
  }, []);

  useEffect(() => {
    if (map.current) return;

    maptilersdk.config.apiKey = MAPTILER_API_KEY;
    map.current = new maptilersdk.Map({
      container: mapContainer.current as HTMLDivElement,
      style: maptilersdk.MapStyle.SATELLITE,
      center: [72.8777, 19.076],
      zoom: 12,
      preserveDrawingBuffer: true,
      dragPan: !rectangleActive,
    });

    map.current.on("load", () => {
      console.log("Map loaded successfully.");
      map.current?.resize();
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;
    rectangleActive ? map.current.dragPan.disable() : map.current.dragPan.enable();
  }, [rectangleActive]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (rectangleActive) {
      setIsDrawing(true);
      setStartCoords({ x: e.clientX, y: e.clientY });
      setEndCoords({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (rectangleActive && isDrawing) {
      setEndCoords({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = async () => {
    if (rectangleActive) {
      setIsDrawing(false);
      setLoading(true);
      console.log("Capturing screenshot...");
      await captureScreenshot();
      setLoading(false);
    }
  };

  const captureScreenshot = async () => {
    const { x: startX, y: startY } = startCoords;
    const { x: endX, y: endY } = endCoords;
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    try {
      const canvas = await html2canvas(mapContainer.current as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const croppedCanvas = document.createElement("canvas");
      const croppedContext = croppedCanvas.getContext("2d");

      croppedCanvas.width = width * 2;
      croppedCanvas.height = height * 2;

      const minX = Math.min(startX, endX) * 2;
      const minY = Math.min(startY, endY) * 2;

      croppedContext?.drawImage(
        canvas,
        minX,
        minY,
        width * 2,
        height * 2,
        0,
        0,
        width * 2,
        height * 2
      );

      const imageData = croppedCanvas.toDataURL("image/png");

      console.log("Screenshot captured successfully.");
      await sendToModel(imageData);
    } catch (error) {
      console.error("Error capturing screenshot:", error);
    }
  };

  const sendToModel = async (imageData: string) => {
    if (!model) {
      console.error("Model is not loaded yet!");
      return;
    }

    try {
      console.log("Preparing image for model...");
      const img = new Image();
      img.src = imageData;

      await new Promise((resolve) => (img.onload = resolve));

      const imageTensor = tf.browser.fromPixels(img); // Convert image to tensor
      console.log("Image Tensor Shape:", imageTensor.shape);

      // Resize and normalize tensor
      const resizedTensor = tf.image.resizeBilinear(imageTensor, [224, 224]); // Resize
      const normalizedTensor = resizedTensor.div(255.0).expandDims(0); // Normalize and batch

      console.log("Normalized Tensor Shape:", normalizedTensor.shape);

      // Run inference on the model
      console.log("Running inference on the model...");
      const predictions = model.predict(normalizedTensor) as tf.Tensor;
      console.log("Predictions received:", predictions.dataSync()); // Log predictions
    } catch (error) {
      console.error("Error sending image to model:", error);
    }
  };

  const handleTestImage = async () => {
    console.log("Test button clicked. Sending pre-loaded image to model...");
    try {
      setButtonLoading(true); // Set button loading state
      await sendToModel(TEST_IMAGE_URL);
      console.log("Test image processed successfully.");
    } catch (error) {
      console.error("Error testing with pre-loaded image:", error);
    } finally {
      setButtonLoading(false); // Reset button loading state
    }
  };


  return (
    <div className="flex h-screen">
      <Sidebar
        onLayerChange={(type) => console.log(`Layer changed to: ${type}`)}
        currentLayer={"none"}
      />

      <Button className="absolute text-6xl top-20 right-20" onClick={handleTestImage}>
        Hi
      </Button>
      <div className="flex-1 relative">
        <MapControls>
          <Button
            variant={rectangleActive ? "default" : "secondary"}
            size="icon"
            onClick={handleTestImage}
            className={cn(
              "transition-all",
              rectangleActive && "bg-primary text-primary-foreground"
            )}
          >
            <Square className="h-4 w-4" />
          </Button>
        </MapControls>

        {buttonLoading ? (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Processing...</span>
          </div>
        ) : null}

        <div
          ref={mapContainer}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: rectangleActive ? "crosshair" : "grab" }}
        />

        {rectangleActive && isDrawing && (
          <div
            className="absolute border-2 border-primary border-dashed pointer-events-none"
            style={{
              left: Math.min(startCoords.x, endCoords.x),
              top: Math.min(startCoords.y, endCoords.y),
              width: Math.abs(endCoords.x - startCoords.x),
              height: Math.abs(endCoords.y - startCoords.y),
            }}
          />
        )}

        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
