export const uploadImagesForRun = async (
    base64Image: string,
    maskImage: string | null,
    folderName: string,
    fileName: string
  ) => {
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image,
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
  