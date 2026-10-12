import mongoose from "mongoose";
import { getServerEnv, isDatabaseConfigured } from "./env";

export class DatabaseConfigurationError extends Error {
  constructor(
    message = "MongoDB is not configured. Please set MONGODB_URI in your .env.local file."
  ) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export class DatabaseConnectionError extends Error {
  constructor(
    message = "Unable to connect to MongoDB. Please verify your MONGODB_URI and network access in MongoDB Atlas."
  ) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!isDatabaseConfigured()) {
    throw new DatabaseConfigurationError();
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const env = getServerEnv();

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      dbName: env.MONGODB_DB_NAME,
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    };

    cached.promise = mongoose
      .connect(env.MONGODB_URI.trim(), opts)
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        throw new DatabaseConnectionError(
          err instanceof Error
            ? `Could not connect to MongoDB (${env.MONGODB_DB_NAME}): ${err.message.replace(
                /mongodb(\+srv)?:\/\/[^\s@]+@/gi,
                "mongodb://***@"
              )}`
            : "Could not connect to MongoDB."
        );
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    if (
      error instanceof DatabaseConfigurationError ||
      error instanceof DatabaseConnectionError
    ) {
      throw error;
    }
    throw new DatabaseConnectionError();
  }
}

