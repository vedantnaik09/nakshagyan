// model/Model.ts

import * as ort from "onnxruntime-web";
import fx from "glfx";
import * as tf from "@tensorflow/tfjs";
import { createMaskTensor, saveTensorToFile } from "@/lib/utils";
import { uploadImagesForRun } from "@/lib/uploadImages";

const providers = [
  "webgl", // Use GPU if needed
];

export const colorDictRgb: ColorDict = {
  0: [41, 169, 226],
  1: [246, 41, 132],
  2: [228, 193, 110],
  3: [152, 16, 60],
  4: [58, 221, 254],
  5: [155, 155, 155],
};

type SegmentedImages = {
  segmentedImage: string;
  masks: {
    water: string;
    land: string;
    vegetation: string;
    road: string;
    building: string;
  };
};

const applyColorJitter = (
  canvas: HTMLCanvasElement,
  brightnessParam = 0.1,
  contrastParam = 0.1,
  saturationParam = 0.1,
  hueParam = 0.1
): void => {
  const glfxCanvas = fx.canvas();
  const texture = glfxCanvas.texture(canvas);

  const randomFactor = (t: number) =>
    Math.random() * (1 + t - (1 - t)) + (1 - t);

  const brightnessFactor = randomFactor(brightnessParam);
  const contrastFactor = randomFactor(contrastParam);
  const saturationFactor = randomFactor(saturationParam);
  const hueFactor = Math.random() * (hueParam * 2) - hueParam;

  glfxCanvas
    .draw(texture)
    .brightnessContrast(brightnessFactor - 1, contrastFactor - 1)
    .hueSaturation(hueFactor, saturationFactor - 1)
    .update();

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context.");
  ctx.drawImage(glfxCanvas, 0, 0);
};

const applyGaussianBlur = (
  canvas: HTMLCanvasElement,
  kernelSize = 3,
  sigmaRange: [number, number] = [0.1, 2.0]
): void => {
  const glfxCanvas = fx.canvas();
  const texture = glfxCanvas.texture(canvas);

  const sigma = Math.random() * (sigmaRange[1] - sigmaRange[0]) + sigmaRange[0];
  const blurRadius = sigma * (kernelSize / 3);

  glfxCanvas.draw(texture).triangleBlur(blurRadius).update();

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context.");
  ctx.drawImage(glfxCanvas, 0, 0);
};

const softmax = (logits: Float32Array): Float32Array => {
  const maxLogit = Math.max(...logits); // Find the maximum logit for numerical stability
  let sumExps = 0;

  // Compute exps and sumExps in one loop
  const exps = logits.map((x) => {
    const expVal = Math.exp(x - maxLogit);
    sumExps += expVal;
    return expVal;
  });

  // Normalize in a second loop
  return exps.map((x) => x / sumExps);
};

const refineSegmentation = (
  segmentation: number[][],
  kernelSize: number = 3
): number[][] => {
  const height = segmentation.length;
  const width = segmentation[0].length;
  const refined = Array.from({ length: height }, () => Array(width).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const neighbors: any[] = [];
      for (
        let ky = -Math.floor(kernelSize / 2);
        ky <= Math.floor(kernelSize / 2);
        ky++
      ) {
        for (
          let kx = -Math.floor(kernelSize / 2);
          kx <= Math.floor(kernelSize / 2);
          kx++
        ) {
          const ny = y + ky;
          const nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            neighbors.push(segmentation[ny][nx]);
          }
        }
      }
      // Most frequent label in the neighborhood
      refined[y][x] = neighbors
        .sort(
          (a, b) =>
            neighbors.filter((v) => v === a).length -
            neighbors.filter((v) => v === b).length
        )
        .pop()!;
    }
  }
  return refined;
};

const downloadImage = (dataURL: string, fileName: string): void => {
  const link = document.createElement("a");
  link.href = dataURL;
  const uniqueFilename = `${fileName}_${Date.now()}.png`;
  link.download = uniqueFilename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 100);
};

const processSegmentationOutput = (
  logits: Float32Array,
  height: number,
  width: number,
  numClasses: number
): number[][] => {
  const segmentation = Array.from({ length: height }, () =>
    Array(width).fill(0)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Compute the start index of logits for the pixel (y, x)
      const idx = y * width * numClasses + x * numClasses;

      // Get logits for all classes at this pixel
      const classLogits = logits.subarray(idx, idx + numClasses);

      // Apply softmax to compute probabilities
      const probs = softmax(classLogits);

      // Find the class with the maximum probability
      let maxIdx = 0;
      let maxVal = -Infinity;
      for (let classIdx = 0; classIdx < numClasses; classIdx++) {
        if (probs[classIdx] > maxVal) {
          maxVal = probs[classIdx];
          maxIdx = classIdx;
        }
      }

      // Assign the class with the highest probability
      segmentation[y][x] = maxIdx;
    }
  }

  console.log("Segmentation before refinement:", segmentation);

  // Optional: Apply refinement
  return refineSegmentation(segmentation);
};

const preprocessImage = (
  image: HTMLImageElement,
  targetSize: [number, number],
  canvas: HTMLCanvasElement
): ort.Tensor => {
  canvas.width = targetSize[1];
  canvas.height = targetSize[0];
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, targetSize[1], targetSize[0]);

  // Apply augmentations if needed
  // applyColorJitter(canvas);
  // applyGaussianBlur(canvas);

  const preprocessedImageDataURL = canvas.toDataURL("image/png");
  // downloadImage(preprocessedImageDataURL, "preprocessed_image");

  const imageData = ctx.getImageData(0, 0, targetSize[1], targetSize[0]);
  const { data } = imageData;
  const inputTensor = new Float32Array(targetSize[0] * targetSize[1] * 3);

  // Normalize pixel values to [0, 1] and reorder to BGR format
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    inputTensor[pixelIndex * 3] = data[i + 2] / 255; // Blue
    inputTensor[pixelIndex * 3 + 1] = data[i + 1] / 255; // Green
    inputTensor[pixelIndex * 3 + 2] = data[i] / 255; // Red
  }

  const inputTensorFloat = new ort.Tensor("float32", inputTensor, [
    1,
    3,
    targetSize[0],
    targetSize[1],
  ]);

  // saveTensorToFile(inputTensorFloat.data, "tensor_values_js.txt");

  console.log("Preprocessed image tensor:", inputTensorFloat);
  console.log("Preprocessed image tensor:", inputTensorFloat.dims);

  return inputTensorFloat;
};

const imageToTensor = (
  image: HTMLImageElement,
  targetSize: [number, number]
) => {
  const tensor = tf.browser.fromPixels(image);

  const resizeTensor = tf.image.resizeBilinear(tensor, targetSize);

  const NormalizedTensor = resizeTensor.div(255.0).expandDims(0);

  const finalTensor = NormalizedTensor.transpose([0, 3, 1, 2]);

  return finalTensor;
};

const onnxTensorToTf: (onnxdata: any, dims: any) => tf.Tensor = (
  onnxdata: any,
  dims: any
): tf.Tensor => {
  const tensor = tf.tensor(onnxdata, dims, "float32");
  const processedTensor = tf.argMax(tensor, 1); // Keep it as a tensor
  return processedTensor;
};



type ColorDict = { [label: string]: [number, number, number] };

const mapSegmentationToRGB = (
  tensor: tf.Tensor, // 2D Tensor with class indices
  colorDict: ColorDict // Dictionary mapping labels to colors
): string => {
  // Convert color dictionary to RGB order
  const colorDictRGB: { [label: string]: [number, number, number] } =
    Object.fromEntries(
      Object.entries(colorDict).map(([label, [b, g, r]]) => [label, [r, g, b]])
    );

  const tensorSqueezed = tensor.squeeze();

  // Get the shape of the tensor
  const [height, width] = tensorSqueezed.shape;

  // Ensure the tensor is 2D
  if (tensorSqueezed.rank !== 2) {
    throw new Error("Input tensor must be 2D (segmentation map).");
  }

  // Convert tensor to a 2D array
  const tensorArray = tensorSqueezed.arraySync() as number[][];

  // Create an empty array to hold the RGBA image
  const rgbaImage: Uint8ClampedArray = new Uint8ClampedArray(height * width * 4); // RGBA format

  // Iterate through each pixel and assign colors
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const classId = tensorArray[y][x];
      const color = colorDictRGB[classId.toString()] || [0, 0, 0]; // Default to black if classId not found

      const offset = (y * width + x) * 4;

      // Assign RGB values
      rgbaImage[offset] = color[0];     // R
      rgbaImage[offset + 1] = color[1]; // G
      rgbaImage[offset + 2] = color[2]; // B

      // Assign Alpha channel
      rgbaImage[offset + 3] = classId !== 0 ? 255 : 0; // Fully opaque if classId is not 0, else transparent
    }
  }

  // Create a canvas to render the RGBA data
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas 2D context.");
  }

  // Create an ImageData object and put it on the canvas
  const imageData = new ImageData(rgbaImage, width, height);
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to base64 and return
  return canvas.toDataURL("image/png"); // Return base64 string of the image
};

const MaskToRGB = (tensor: tf.Tensor): string => {
  const tensorSqueezed = tensor.squeeze();

  // Get the shape of the tensor
  const [height, width] = tensorSqueezed.shape;

  // Ensure the tensor is 2D
  if (tensorSqueezed.rank !== 2) {
    throw new Error("Input tensor must be 2D (segmentation map).");
  }

  // Convert tensor to a 2D array
  const tensorArray = tensorSqueezed.arraySync() as number[][];

  // Create an empty array to hold the RGBA image
  const rgbaImage: Uint8ClampedArray = new Uint8ClampedArray(height * width * 4); // RGBA format

  // Iterate through each pixel and set the RGBA values
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const classId = tensorArray[y][x];

      // Skip if the class ID is 0 (transparent)
      if (classId === 0) continue;

      const offset = (y * width + x) * 4;

      // Assign RGB values based on class ID
      const color = colorDictRgb[classId.toString()] || [0, 0, 0]; // Default to black if classId not found

      rgbaImage[offset + 2] = color[0];     // R
      rgbaImage[offset + 1] = color[1]; // G
      rgbaImage[offset + 0] = color[2]; // B

      // Assign Alpha channel
      rgbaImage[offset + 3] = 255; // Fully opaque
    }
  }

  // Create a canvas to render the RGBA data
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to get canvas 2D context.");
  }

  // Create an ImageData object and put it on the canvas
  const imageData = new ImageData(rgbaImage, width, height);
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to base64 and return
  return canvas.toDataURL("image/png"); // Return base64 string of the image
};

export const applyONNXSegmentation = async (
  modelPath: string,
  inputImage: HTMLImageElement,
  onSegmentedImageReady: (images: SegmentedImages) => void, // Updated signature
  canvas: HTMLCanvasElement,
  folderName: string ,// Pass folder name for consistent uploads
  topLeft: { lat: number; lon: number },
  bottomRight: { lat: number; lon: number }
): Promise<void> => {
  try {
    // Load ONNX model
    console.log("Loading ONNX model...");
    const sessionGPU = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["wasm"],
    });

    console.log("Model loaded successfully:", sessionGPU);

    // Preprocess image
    const processedTensor = imageToTensor(inputImage, [256, 256]);
    console.log("Preprocessed image tensor:", processedTensor.shape);

    // saveTensorToFile(processedTensor.dataSync(), "input_Tensor");

    // Get input and output names
    const inputName = sessionGPU.inputNames[0];
    console.log("Model input name:", inputName);

    // Run model inference
    const inputTensorONNX = new ort.Tensor(
      "float32",
      processedTensor.dataSync(),
      processedTensor.shape
    );
    // saveTensorToFile(inputTensorONNX.data, "input_Tensor_ONNX");
    const resultGPU = await sessionGPU.run({ [inputName]: inputTensorONNX });

    console.log("GPU Result:", resultGPU);

    // Get output tensor
    const outputName = sessionGPU.outputNames[0];
    console.log("Model output name:", outputName);

    const outputTensor = resultGPU[outputName];
    console.log("Output Tensor:", outputTensor.dims);

    // saveTensorToFile(outputTensor.data, "output_Tensor");
//
    // Process segmentation
    console.log("Processing Segmentation Output...");
    const segmentation = onnxTensorToTf(outputTensor.data, outputTensor.dims);

    console.log("Segmentation after processing:", segmentation);
    // saveTensorToFile(segmentation.dataSync(), "output_Tensor_tf");

    // Generate mask images for different classes with RGBA
    const maskTensorBase64Water = await createMaskTensor(segmentation, 0, 'rgba(41, 169, 226, 1)', topLeft, bottomRight, 'water');
    const maskTensorBase64Land = await createMaskTensor(segmentation, 1, 'rgba(246, 41, 132, 1)', topLeft, bottomRight, 'land');
    const maskTensorBase64Vegetation = await createMaskTensor(segmentation, 2, 'rgba(228, 193, 110, 1)', topLeft, bottomRight, 'vegetation');
    const maskTensorBase64Road = await createMaskTensor(segmentation, 3, 'rgba(152, 16, 60, 1)', topLeft, bottomRight, 'road');
    const maskTensorBase64Building = await createMaskTensor(segmentation, 4, 'rgba(58, 221, 254, 1)', topLeft, bottomRight, 'building');

    localStorage.setItem("base64", JSON.stringify({
      "water": maskTensorBase64Water,
      "land": maskTensorBase64Land,
      "vegetation": maskTensorBase64Vegetation,
      "road": maskTensorBase64Road,
      "building": maskTensorBase64Building,
    }));

    // Generate segmented image with RGBA
    const base64Image = mapSegmentationToRGB(segmentation, colorDictRgb);
    // console.log("Segmented Image Base64:", base64Image);

    // downloadImage(base64Image, "output_segmented");
    console.log("Segmented Image Base64:", base64Image);
    // console.log("Segmented Image Base64:", base64Image);
    // console.log("Segmented Image Base64:", base64Image);

    
    await uploadImagesForRun(base64Image, null, folderName, "segmented.png");

    console.log(`Uploaded base64 image to folder: ${folderName}`);

    console.log(`Uploaded to Cloudinary Folder: ${folderName}`);
    // Invoke the callback with both segmented image and masks
    onSegmentedImageReady({
      segmentedImage: base64Image,
      masks: {
        water: maskTensorBase64Water,
        land: maskTensorBase64Land,
        vegetation: maskTensorBase64Vegetation,
        road: maskTensorBase64Road,
        building: maskTensorBase64Building,
      },
    });
  } catch (error) {
    console.error("Error applying ONNX segmentation:", error);
  }
};
