const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

const FIREBASE_DATABASE_URL = "https://flyer-genie.firebaseio.com";
const DEFAULT_LOCALE = "en";
const MIN_PASSWORD_LENGTH = 6;

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const trimmedToken = token.slice(2);

    if (!trimmedToken) {
      continue;
    }

    const [key, inlineValue] = trimmedToken.split("=");

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextToken;
    index += 1;
  }

  return args;
};

const printUsage = () => {
  console.log(`Usage:
  node setup/createSuperAdmin.js --username <username> --displayName <display name> --password <password> [--locale <locale>]

Example:
  node setup/createSuperAdmin.js --username platform-root --displayName "Platform Root" --password "change-this-password" --locale en`);
};

const getOption = (args, key, envKey, fallback = "") => {
  const argValue = args[key];

  if (typeof argValue === "string" && argValue.trim()) {
    return argValue.trim();
  }

  const envValue = process.env[envKey];

  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  return fallback;
};

const ensureFirebase = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: FIREBASE_DATABASE_URL,
  });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const username = getOption(args, "username", "SUPER_ADMIN_USERNAME");
  const displayName = getOption(args, "displayName", "SUPER_ADMIN_DISPLAY_NAME");
  const password = getOption(args, "password", "SUPER_ADMIN_PASSWORD");
  const locale = getOption(args, "locale", "SUPER_ADMIN_LOCALE", DEFAULT_LOCALE);

  if (!username || !displayName || !password) {
    printUsage();
    throw new Error("username, displayName, and password are required");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  ensureFirebase();
  const db = admin.firestore();

  const existingStaffQuery = await db
    .collection("staffs")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (!existingStaffQuery.empty) {
    throw new Error(`staff username already exists: ${username}`);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const timestamp = new Date().toISOString();
  const staffRef = db.collection("staffs").doc();

  await staffRef.set({
    username,
    displayName,
    password: hashedPassword,
    role: "super-admin",
    companyId: null,
    profile: {
      locale,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    isActive: true,
  });

  console.log("Super admin created successfully");
  console.log(
    JSON.stringify(
      {
        id: staffRef.id,
        username,
        displayName,
        role: "super-admin",
        locale,
      },
      null,
      2,
    ),
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to create super admin:", error.message);
    process.exit(1);
  });