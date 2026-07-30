const path = require("path");
const {Storage} = require("@google-cloud/storage");
const sharp = require("sharp");

const storage = new Storage();

const SOURCE_BUCKET = "flyer-genie.firebasestorage.app";
const SOURCE_PREFIX = "flyers/";
const DEST_PREFIX = "flyer-thumbnails/";

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/gif",
]);

/**
 * Map the source object to the destination thumbnail path by basename only.
 * @param {string} sourceName
 * @return {string}
 */
function buildDestinationName(sourceName) {
  const filename = path.basename(sourceName);
  return `${DEST_PREFIX}${filename}`;
}

/**
 * Compress and resize the source image based on file extension.
 * @param {Buffer} buffer
 * @param {string} extension
 * @return {Promise<Buffer>}
 */
function compressImage(buffer, extension) {
  const image = sharp(buffer, {animated: false}).rotate();

  // Resize down for lightweight thumbnails while preserving aspect ratio.
  image.resize({
    width: 1280,
    height: 1280,
    fit: "inside",
    withoutEnlargement: true,
  });

  switch ((extension || "").toLowerCase()) {
    case ".png":
      return image.png({
        compressionLevel: 9,
        quality: 70,
        palette: true,
      }).toBuffer();
    case ".webp":
      return image.webp({quality: 72}).toBuffer();
    case ".avif":
      return image.avif({quality: 50}).toBuffer();
    case ".tif":
    case ".tiff":
      return image.tiff({quality: 70}).toBuffer();
    case ".jpg":
    case ".jpeg":
    case ".gif":
    default:
      return image.jpeg({quality: 72, mozjpeg: true}).toBuffer();
  }
}

/**
 * Handle finalized storage objects and write compressed thumbnails.
 * @param {Object} event
 * @return {Promise<void>}
 */
async function compressFlyerImageHandler(event) {
  const data = event.data || {};
  const bucketName = data.bucket;
  const objectName = data.name;
  const contentType = data.contentType || "";

  if (!bucketName || !objectName) {
    console.log("Skipping event with missing bucket/name", {
      bucketName,
      objectName,
    });
    return;
  }

  if (bucketName !== SOURCE_BUCKET) {
    return;
  }

  if (!objectName.startsWith(SOURCE_PREFIX)) {
    return;
  }

  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    console.log("Skipping non-image object", {objectName, contentType});
    return;
  }

  const destinationName = buildDestinationName(objectName);

  if (objectName === destinationName) {
    return;
  }

  const bucket = storage.bucket(bucketName);
  const sourceFile = bucket.file(objectName);
  const destinationFile = bucket.file(destinationName);

  const [sourceBuffer] = await sourceFile.download();
  const extension = path.extname(objectName);
  const compressedBuffer = await compressImage(sourceBuffer, extension);

  let outputContentType = contentType;
  if ([".jpg", ".jpeg", ".gif"].includes(extension.toLowerCase())) {
    outputContentType = "image/jpeg";
  }

  await destinationFile.save(compressedBuffer, {
    resumable: false,
    contentType: outputContentType,
    metadata: {
      metadata: {
        sourceObject: objectName,
        compressedAt: new Date().toISOString(),
      },
    },
  });

  console.log("Compressed thumbnail written", {
    source: objectName,
    destination: destinationName,
    originalBytes: sourceBuffer.length,
    compressedBytes: compressedBuffer.length,
  });
}

module.exports = {
  compressFlyerImageHandler,
};
