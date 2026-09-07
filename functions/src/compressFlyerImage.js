const path = require("path");
const {pipeline} = require("stream/promises");
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
 * Create a streaming sharp transform for the source image.
 * Streaming avoids keeping both the complete source and output buffers in
 * the Node.js heap at the same time.
 * @return {sharp.Sharp}
 */
function createImageTransform() {
  const image = sharp({
    animated: false,
    // Prevent pathological images from consuming excessive native memory.
    limitInputPixels: 40_000_000,
  }).rotate();

  // A 640px thumbnail is sufficient for the UI and greatly reduces file size.
  image.resize({
    width: 640,
    height: 640,
    fit: "inside",
    withoutEnlargement: true,
  });

  // Normalize every thumbnail to JPEG. Keeping PNG/TIFF compression settings
  // can still produce 500KB+ files, especially for flyer artwork.
  return image.jpeg({
    quality: 50,
    chromaSubsampling: "4:2:0",
    progressive: true,
    mozjpeg: true,
  });
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

  const outputContentType = "image/jpeg";

  const compressedAt = new Date().toISOString();
  const destinationStream = destinationFile.createWriteStream({
    resumable: false,
    contentType: outputContentType,
    metadata: {
      metadata: {sourceObject: objectName, compressedAt},
    },
  });

  // Stream from Cloud Storage through sharp instead of buffering the entire
  // source and compressed output in memory.
  await pipeline(
      sourceFile.createReadStream(),
      createImageTransform(),
      destinationStream,
  );

  await destinationFile.makePublic();

  console.log("Compressed thumbnail written", {
    source: objectName,
    destination: destinationName,
    originalBytes: Number(data.size || 0),
  });
}

module.exports = {
  compressFlyerImageHandler,
};
