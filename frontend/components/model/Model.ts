import * as ort from "onnxruntime-web";
import fx from "glfx";
import { AnyARecord } from "dns";

const providers = [
  "webgl", // Use GPU if needed
];

type ColorDict = Record<number, [number, number, number]>;

const colorDictRgb: ColorDict = {
  0: [41, 169, 226],
  1: [246, 41, 132],
  2: [228, 193, 110],
  3: [152, 16, 60],
  4: [58, 221, 254],
  5: [155, 155, 155],
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

  ctx.drawImage(image, 0, 0, targetSize[1], targetSize[0]);

  // Apply augmentations if needed
  // applyColorJitter(canvas);
  // applyGaussianBlur(canvas);

  const preprocessedImageDataURL = canvas.toDataURL("image/png");
  downloadImage(preprocessedImageDataURL, "preprocessed_image");

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

  saveTensorToFile(inputTensorFloat.data, "tensor_values_js.txt");

  console.log("Preprocessed image tensor:", inputTensorFloat);
  console.log("Preprocessed image tensor:", inputTensorFloat.dims);

  return inputTensorFloat;
};

const saveTensorToFile = (tensorData: any, fileName: string) => {
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

const mapSegmentationToColor = (
  segmentation: number[][],
  height: number,
  width: number
): Uint8ClampedArray => {
  const colorData = new Uint8ClampedArray(height * width * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = segmentation[y][x];
      const color = colorDictRgb[label] || colorDictRgb[5];
      const idx = (y * width + x) * 4;
      colorData[idx] = color[0];
      colorData[idx + 1] = color[1];
      colorData[idx + 2] = color[2];
      colorData[idx + 3] = 255;
    }
  }
  return colorData;
};
export const applyONNXSegmentation = async (
  modelPath: string,
  inputImage: HTMLImageElement,
  onSegmentedImageReady: (base64: string, segmentation: number[][]) => void,
  canvas: HTMLCanvasElement
): Promise<void> => {
  try {
    // Load ONNX model
    console.log("Loading ONNX model...");
    console.log("providers:", providers);
    const sessionGPU = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["wasm"],
    });

    console.log("Model loaded successfully:", sessionGPU);

    // Preprocess image
    const processedTensor = preprocessImage(inputImage, [256, 256], canvas);
    console.log("Preprocessed image tensor:", processedTensor.dims);

    // Check the input name expected by the model
    const inputName = sessionGPU.inputNames[0]; // Access the first input name
    console.log("Model input name:", inputName);

    // Run model inference

    const resultGPU = await sessionGPU.run({ [inputName]: processedTensor });

    console.log("GPU Result:", resultGPU);

    // Check the output name(s)
    const outputName = sessionGPU.outputNames[0]; // Access the first output name
    console.log("Model output name:", outputName);

    // Get the output tensor
    const outputTensor = resultGPU[outputName];
    console.log("Output Tensor:", outputTensor);

    const outputData = outputTensor.data as Float32Array;
    const height = 256;
    const width = 256;
    const numClasses = 6; // Number of segmentation classes

    // Use processSegmentationOutput to decode segmentation
    console.log("Processing Segmentation Output...");
    const segmentation = processSegmentationOutput(
      outputData,
      height,
      width,
      numClasses
    );

    console.log("Segmentation after processing:", segmentation);

    // Map segmentation to color and draw on canvas
    const colorMappedImage = mapSegmentationToColor(
      segmentation,
      height,
      width
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context for mask.");
    const imageData = new ImageData(colorMappedImage, width, height);
    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to base64 and return
    const segmentedImageBase64 = canvas.toDataURL("image/png");
    onSegmentedImageReady(segmentedImageBase64, segmentation);
  } catch (error) {
    console.error("Error applying ONNX segmentation:", error);
  }
};
