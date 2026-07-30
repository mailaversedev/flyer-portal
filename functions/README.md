# Functions

## compressFlyerImage

Cloud Function (2nd gen) that listens to image uploads in:

- Bucket: `flyer-genie.firebasestorage.app`
- Source folder: `flyer/`

And writes compressed outputs to:

- Destination folder: `flyer-thumbnail/`
- Filename: same as source filename (basename only)

Implementation layout:

- Entry export: `functions/index.js`
- Handler module: `functions/src/compressFlyerImage.js`

## Deploy

From repository root:

```bash
firebase deploy --only functions:compressFlyerImage
```

Or deploy all functions:

```bash
firebase deploy --only functions
```

## Environment Variables

- `SOURCE_BUCKET` default: `flyer-genie.firebasestorage.app`
- `SOURCE_PREFIX` default: `flyer/`
- `DEST_PREFIX` default: `flyer-thumbnail/`

## Notes

- Only image files are processed.
- Objects outside `flyer/` are ignored.
- If multiple source files share the same basename in different subfolders, they map to the same destination object in `flyer-thumbnail/`.
