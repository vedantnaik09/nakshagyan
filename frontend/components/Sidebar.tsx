"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Droplet, Trees, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import * as tf from "@tensorflow/tfjs"; // Import TensorFlow.js
import "@tensorflow/tfjs-backend-webgl"; // Import WebGL backend

const MODEL_URL = "/models/model.json"; // Path to your model.json in public/models
const TEST_IMAGE_URL = "/image.png"; // Path to the test image in public/

interface SidebarProps {
  onLayerChange: (type: "water" | "forests" | "none" | "all") => void;
  currentLayer: "water" | "forests" | "none" | "all";
  handleSetWMSURL: (url: string) => void;
  availableLayers: string[];
  handleWMSLayerChange: (layer: string) => void;
}

export function Sidebar({
  onLayerChange,
  currentLayer,
  handleSetWMSURL,
  availableLayers,
  handleWMSLayerChange,
}: SidebarProps) {
  const [loading, setLoading] = useState(false); // Manage test button state
  const [model, setModel] = useState<tf.LayersModel | null>(null); // Store the TensorFlow model

  // Set TensorFlow.js backend to WebGL
  useEffect(() => {
    const initializeBackend = async () => {
      try {
        await tf.setBackend("webgl"); // Use the WebGL backend for GPU acceleration
        await tf.ready(); // Wait for TensorFlow.js to initialize the backend
        console.log(
          "TensorFlow.js is using the WebGL backend for GPU acceleration."
        );
      } catch (error) {
        console.error("Error initializing TensorFlow.js WebGL backend:", error);
      }
    };
    initializeBackend();
  }, []);

  // Load the TensorFlow.js model on component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Loading model...");
        const loadedModel = await tf.loadLayersModel(MODEL_URL); // Use tf.loadLayersModel
        console.log("Model loaded successfully:", loadedModel);
        setModel(loadedModel);
      } catch (error) {
        console.error("Error loading TensorFlow model:", error);
      }
    };
    loadModel();
  }, []);

  // Send an image to the model for inference
  const sendToModel = async () => {
    if (!model) {
      console.error("Model is not loaded yet!");
      return;
    }

    try {
      console.log("Preparing image for model...");
      const img = new Image();
      img.src = TEST_IMAGE_URL;

      await new Promise((resolve) => (img.onload = resolve)); // Wait for image to load

      const imageTensor = tf.browser.fromPixels(img); // Convert the image to a tensor
      console.log("Image Tensor Shape:", imageTensor.shape);

      // Resize to model input shape [256, 256, 3]
      const resizedTensor = tf.image.resizeBilinear(imageTensor, [256, 256]);

      // Normalize pixel values to [0, 1]
      const normalizedTensor = resizedTensor.div(255.0).expandDims(0); // Add batch dimension

      console.log("Normalized Tensor Shape:", normalizedTensor.shape);

      // Run inference
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
      setLoading(true); // Set loading state
      await sendToModel();
      console.log("Test image processed successfully.");
    } catch (error) {
      console.error("Error testing with pre-loaded image:", error);
    } finally {
      setLoading(false); // Reset loading state
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
    <div className="pb-12 w-64">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Layers</h2>
          <ScrollArea className="h-[300px] px-1">
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
                >
                  <layer.icon className="h-4 w-4" />
                  {layer.name}
                </Button>
              ))}
              <Separator className="my-2" />
              <Button
                onClick={() => onLayerChange("none")}
                variant={currentLayer === "none" ? "default" : "ghost"}
                className="w-full justify-start"
              >
                Clear All
              </Button>
            </div>
          </ScrollArea>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Set WMS URL</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Paste WMS URL here..."
              className="border rounded-md p-2"
              onChange={(e) => handleSetWMSURL(e.target.value)} // Pass URL to the handler
            />
          </div>
        </div>
        <div className="px-3 py-2">
          <h2 className="text-lg font-bold">Available Layers</h2>
          {availableLayers.length > 0 ? (
            <ul>
              {availableLayers.map((layer, index) => (
                <li key={index} className="py-1">
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => handleWMSLayerChange(layer)}
                  >
                    {layer}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No layers available or loading...</p>
          )}
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Actions</h2>
          <Button
            onClick={handleTestImage}
            className="w-full bg-primary text-primary-foreground"
            disabled={loading} // Disable the button while loading
          >
            {loading ? "Processing..." : "Test Pre-loaded Image"}
          </Button>
        </div>
      </div>
    </div>
  );
}
