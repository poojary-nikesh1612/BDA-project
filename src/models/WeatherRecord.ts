import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWeatherRecord extends Document {
  _id: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  timestamp: Date;
  city?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  rainfall?: number | null;
  windSpeed?: number | null;
  weatherCondition?: string | null;
  rawRowNumber: number;
  dedupeKey: string;
   createdAt: Date;
  updatedAt: Date;
}

const WeatherRecordSchema = new Schema<IWeatherRecord>(
  {
    datasetId: {
      type: Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    city: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    temperature: {
      type: Number,
      default: null,
    },
    humidity: {
      type: Number,
      default: null,
    },
    rainfall: {
      type: Number,
      default: null,
    },
    windSpeed: {
      type: Number,
      default: null,
    },
    weatherCondition: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },
    rawRowNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    dedupeKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Dataset-scoped indexes for fast analytics, filtering, sorting, and idempotency
WeatherRecordSchema.index({ datasetId: 1, timestamp: 1 });
WeatherRecordSchema.index({ datasetId: 1, city: 1, timestamp: 1 });
WeatherRecordSchema.index({ datasetId: 1, temperature: 1 });
WeatherRecordSchema.index({ datasetId: 1, weatherCondition: 1 });
WeatherRecordSchema.index({ datasetId: 1, dedupeKey: 1 }, { unique: true });

export const WeatherRecordModel: Model<IWeatherRecord> =
  mongoose.models.WeatherRecord ||
  mongoose.model<IWeatherRecord>("WeatherRecord", WeatherRecordSchema);

