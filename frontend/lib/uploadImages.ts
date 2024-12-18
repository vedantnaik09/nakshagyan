const compressImage = (
  base64Image: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed"));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const compressedBase64 = reader.result as string;
            resolve(compressedBase64);
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image for compression"));
  });
};

export const uploadImagesForRun = async (
  base64Image: string,
  maskImage: string | null,
  folderName: string,
  fileName: string
): Promise<any> => {
  try {
    // Compress the base64 image before uploading
    const compressedBase64Image = await compressImage(base64Image, 1024, 1024, 0.8);

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Image: compressedBase64Image,
        maskImage,
        folderName,
        fileName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to upload images: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error uploading images:", error);
    throw error;
  }
};
