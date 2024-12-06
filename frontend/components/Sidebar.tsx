"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Droplet, Trees, Layers, Globe2, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

const MODEL_URL = "/models/39epochs_g.onnx";
const TEST_IMAGE_URL = "/image.png";

interface SidebarProps {
  onLayerChange: (type: "water" | "forests" | "none" | "all") => void;
  currentLayer: "water" | "forests" | "none" | "all";
  handleSetWMSURL: (url: string) => void;
  availableLayers: string[];
  handleWMSLayerChange: (layer: string) => void;
  handleSatelliteLayerChange: (layer: string) => void;
}

export function Sidebar({
  onLayerChange,
  currentLayer,
  handleSetWMSURL,
  availableLayers,
  handleWMSLayerChange,
  handleSatelliteLayerChange,
}: SidebarProps) {
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [activeWMSLayer, setActiveWMSLayer] = useState<string | null>(null);
  const [activeSatelliteLayer, setActiveSatelliteLayer] = useState<
    string | null
  >(null);

  useEffect(() => {
    const initializeBackend = async () => {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        console.log(
          "TensorFlow.js is using the WebGL backend for GPU acceleration."
        );
      } catch (error) {
        console.error("Error initializing TensorFlow.js WebGL backend:", error);
      }
    };
    initializeBackend();
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Loading model...");
        const loadedModel = await tf.loadLayersModel(MODEL_URL);
        console.log("Model loaded successfully:", loadedModel);
        setModel(loadedModel);
      } catch (error) {
        console.error("Error loading TensorFlow model:", error);
      }
    };
    loadModel();
  }, []);

  const sendToModel = async () => {
    if (!model) {
      console.error("Model is not loaded yet!");
      return;
    }

    try {
      console.log("Preparing image for model...");
      const img = new Image();
      img.src = TEST_IMAGE_URL;

      await new Promise((resolve) => (img.onload = resolve));

      const imageTensor = tf.browser.fromPixels(img);
      console.log("Image Tensor Shape:", imageTensor.shape);

      const resizedTensor = tf.image.resizeBilinear(imageTensor, [256, 256]);
      const normalizedTensor = resizedTensor.div(255.0).expandDims(0);

      console.log("Normalized Tensor Shape:", normalizedTensor.shape);
      console.log("Running inference on the model...");
      const predictions = model.predict(normalizedTensor) as tf.Tensor;
      console.log("Predictions received:", predictions.dataSync());
    } catch (error) {
      console.error("Error sending image to model:", error);
    }
  };

  const handleTestImage = async () => {
    console.log("Test button clicked. Sending pre-loaded image to model...");
    try {
      setLoading(true);
      await sendToModel();
      console.log("Test image processed successfully.");
    } catch (error) {
      console.error("Error testing with pre-loaded image:", error);
    } finally {
      setLoading(false);
    }
  };

  const layers = [
    {
      id: "water",
      name: "Water Bodies",
      icon: Droplet,
      description: "Show water bodies and water features",
    },
    {
      id: "forests",
      name: "Forest Areas",
      icon: Trees,
      description: "Show forest coverage and vegetation",
    },
    {
      id: "all",
      name: "All Layers",
      icon: Layers,
      description: "Show all available layers",
    },
  ] as const;

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">Layers</h2>
            <div className="space-y-1">
              {layers.map((layer) => (
                <Button
                  key={layer.id}
                  onClick={() => onLayerChange(layer.id)}
                  variant={currentLayer === layer.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2",
                    currentLayer === layer.id &&
                      "bg-primary text-primary-foreground"
                  )}
                  title={`Activate ${layer.description}`}
                >
                  <layer.icon
                    className={cn(
                      "h-4 w-4",
                      currentLayer === layer.id &&
                        "border-2 border-red-500 rounded"
                    )}
                  />
                  {layer.name}
                </Button>
              ))}
              <Separator className="my-2" />
              <Button
                onClick={() => onLayerChange("none")}
                variant={currentLayer === "none" ? "default" : "ghost"}
                className="w-full justify-start"
                title="Clear all layers"
              >
                Clear All
              </Button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Set WMS URL</h2>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Paste WMS URL here..."
                className="w-full border rounded-md p-2 bg-secondary/50"
                onChange={(e) => handleSetWMSURL(e.target.value)}
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Available Layers</h2>
            {availableLayers.length > 0 ? (
              <div className="space-y-2 h-72 overflow-y-scroll">
                {" "}
                {/* Added height and scrolling */}
                {availableLayers.map((layer, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-secondary/50 p-2 rounded-lg"
                  >
                    <span className="flex-grow font-medium">{layer}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveWMSLayer(layer);
                          handleWMSLayerChange(layer);
                        }}
                        title="Set layer to view"
                      >
                        <Globe2
                          color={`${
                            activeWMSLayer === layer ? "green" : "white"
                          }`}
                          className="h-4 w-4"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveSatelliteLayer(layer);
                          handleSatelliteLayerChange(layer);
                        }}
                        title="Set layer for satellite segmentation"
                      >
                        <Satellite
                          color={`${
                            activeSatelliteLayer === layer ? "green" : "white"
                          }`}
                          className="h-4 w-4"
                        />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No layers available</p>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Actions</h2>
            <Button
              onClick={handleTestImage}
              className="w-full bg-primary text-primary-foreground"
              disabled={loading}
            >
              {loading ? "Processing..." : "Test Pre-loaded Image"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
