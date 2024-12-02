"use client"
import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';

const ImageSegmentation: React.FC = () => {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModelAndSegment = async () => {
      try {
        // Load the model from the public folder
        const modelUrl = '/models/model.json';
        const model = await tf.loadLayersModel(modelUrl);

        // Ensure the image is loaded
        if (!imageRef.current) return;

        // Convert the image to a tensor
        const imageTensor = tf.browser.fromPixels(imageRef.current);

        // Resize tensor to match the model input shape [256, 256, 3]
        const resizedTensor = tf.image.resizeBilinear(imageTensor, [256, 256]).expandDims(0);

        // Normalize the image (if required by the model)
        const normalizedTensor = resizedTensor.div(255);

        // Perform segmentation
        const prediction = model.predict(normalizedTensor) as tf.Tensor;

        // Process the segmentation mask
        const mask = prediction.squeeze(); // Remove batch dimension if needed

        // Debugging: Log the shape and range of the mask values
        console.log('Mask shape:', mask.shape);
        const maskArray = await mask.array() as number[][]; // Explicit cast to 2D array
        console.log('Mask values:', maskArray); // Print mask values

        // Create the segmentation image
        const segmentationImage = createSegmentationImage(maskArray);

        // Render the segmentation result on canvas
        renderToCanvas(segmentationImage);

        // Dispose tensors to free memory
        imageTensor.dispose();
        resizedTensor.dispose();
        normalizedTensor.dispose();
        prediction.dispose();

        setLoading(false);
      } catch (error) {
        console.error('Error during segmentation:', error);
      }
    };

    loadModelAndSegment();
  }, []);

  // Helper: Map segmentation output to RGBA image
  const createSegmentationImage = (maskArray: number[][]): ImageData => {
    const height = maskArray.length;
    const width = maskArray[0].length;

    const rgbaImage = new Uint8ClampedArray(width * height * 4); // 4 for RGBA

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const maskValue = maskArray[y][x]; // Assume value is class index or confidence
        const i = (y * width + x) * 4;

        // Check for the mask value and map to a color
        if (maskValue > 0.5) { // Example threshold for binary segmentation
          rgbaImage[i] = 255;   // Red
          rgbaImage[i + 1] = 0; // Green
          rgbaImage[i + 2] = 0; // Blue
        } else {
          rgbaImage[i] = 0;     // Red
          rgbaImage[i + 1] = 0; // Green
          rgbaImage[i + 2] = 0; // Blue
        }

        rgbaImage[i + 3] = 255; // Alpha (fully opaque)
      }
    }

    return new ImageData(rgbaImage, width, height);
  };

  // Helper: Render segmentation to canvas
  const renderToCanvas = (imageData: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  };

  return (
    <div>
      <h1>Image Segmentation with TensorFlow.js</h1>
      {loading && <p>Loading model and processing...</p>}
      <img
        ref={imageRef}
        src="/image.png" // Path to your image
        alt="Input"
        style={{ display: loading ? 'none' : 'block', maxWidth: '100%' }}
      />
      <canvas ref={canvasRef} style={{ border: '1px solid black', marginTop: '10px' }} />
    </div>
  );
};

export default ImageSegmentation;
