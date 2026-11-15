const admin = require("firebase-admin");

async function unreferencedImages(db, cutoffMs) {
  const references = new Set();
  const read = async (name, visit) => {
    let cursor = null;
    while (true) {
      let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(200);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      for (const doc of snapshot.docs) visit(doc);
      if (snapshot.docs.length < 200) break;
      cursor = snapshot.docs.at(-1);
    }
  };
  await read("jetsoPosts", (doc) => {
    const record = doc.data();
    for (const content of [record.draft, record.publicSnapshot]) {
      for (const url of content?.imageUrls || []) references.add(url);
    }
  });
  const orphaned = [];
  await read("jetsoPostImages", (doc) => {
    const image = doc.data();
    if (!references.has(image.url) && new Date(image.uploadedAt).getTime() < cutoffMs) {
      orphaned.push({ imageId: doc.id, objectPath: image.objectPath, url: image.url, uploadedAt: image.uploadedAt });
    }
  });
  return orphaned;
}

if (require.main === module) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  unreferencedImages(admin.firestore(), Date.now() - 7 * 86400000)
    .then((images) => {
      console.log("Review only: re-check all current draft/public references before deleting any object.");
      console.log(JSON.stringify(images, null, 2));
    })
    .catch((error) => {
      console.error("Could not report blog image references:", error);
      process.exitCode = 1;
    });
}

module.exports = { unreferencedImages };
