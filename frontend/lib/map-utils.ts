export async function downloadMapSegment(base64Image: string) {
  const link = document.createElement("a");
  link.href = base64Image;
  link.download = `map-segment-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

