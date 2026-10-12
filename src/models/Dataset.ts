import mongoose, { Schema, Document, Model } from "mongoose";

export type NormalizedFieldKey =
  | "timestamp"
  | "city"
  | "temperature"
  | "humidity"
  | "rainfall"
  | "windSpeed"
  | "weatherCondition";

export type ColumnMapping = Partial<Record<NormalizedFieldKey, string>>;

export type ImportStatus = "pending" | "importing" | "completed" | "failed";

export interface IImportIssuePreview {
  rowNumber: number;
  severity: "fatal" | "warning" | "duplicate";
  issueType: string;
  field?: string;
  originalValue?: string;
  message: string;
}

export interface IDataset extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  originalFilename: string;
  description: string;
  workspaceId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateRowCount: number;
  warningCount: number;
  columns: string[];
  columnMapping: ColumnMapping;
  defaultCity?: string;
  availableMetrics: string[];
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
  importStatus: ImportStatus;
  importIssuePreview: IImportIssuePreview[];
  createdAt: Date;
  updatedAt: Date;
}

const ImportIssuePreviewSchema = new Schema<IImportIssuePreview>(
  {
    rowNumber: { type: Number, required: true },
    severity: {
      type: String,
      enum: ["fatal", "warning", "duplicate"],
      required: true,
    },
    issueType: { type: String, required: true },
    field: { type: String },
    originalValue: { type: String },
    message: { type: String, required: true },
  },
  { _id: false }
);

const DatasetSchema = new Schema<IDataset>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
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
    rowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    validRowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    invalidRowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    duplicateRowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    warningCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    columns: {
      type: [String],
      default: [],
    },
    columnMapping: {
      type: Schema.Types.Mixed,
      default: {},
    },
    defaultCity: {
      type: String,
      trim: true,
    },
    availableMetrics: {
      type: [String],
      default: [],
    },
    dateRangeStart: {
      type: Date,
      default: null,
    },
    dateRangeEnd: {
      type: Date,
      default: null,
    },
    importStatus: {
      type: String,
      enum: ["pending", "importing", "completed", "failed"],
      default: "pending",
    },
    importIssuePreview: {
      type: [ImportIssuePreviewSchema],
      default: [],
      validate: [
        (val: IImportIssuePreview[]) => val.length <= 100,
        "importIssuePreview cannot exceed 100 items",
      ],
    },
  },
  {
    timestamps: true,
  }
);

DatasetSchema.index({ workspaceId: 1, ownerId: 1, createdAt: -1 });
DatasetSchema.index({ ownerId: 1, createdAt: -1 });

export const DatasetModel: Model<IDataset> =
  mongoose.models.Dataset || mongoose.model<IDataset>("Dataset", DatasetSchema);

