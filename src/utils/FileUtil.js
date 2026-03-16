export const isFile = (value) => value instanceof File;

export const isDataUrl = (value) =>
  typeof value === "string" && value.startsWith("data:");

export const isBlobUrl = (value) =>
  typeof value === "string" && value.startsWith("blob:");

export const dataUrlToFile = (dataUrl, filename = "image.png") => {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};

export const blobUrlToFile = async (blobUrl, filename = "image.png") => {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to read blob URL: ${response.status}`);
  }

  const blob = await response.blob();
  const extension = blob.type?.split("/")[1] || "png";
  const resolvedName = filename.includes(".")
    ? filename
    : `${filename}.${extension}`;

  return new File([blob], resolvedName, {
    type: blob.type || "image/png",
  });
};
