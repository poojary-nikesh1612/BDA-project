import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWorkspace extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  ownerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

WorkspaceSchema.index({ ownerId: 1, createdAt: -1 });

export const WorkspaceModel: Model<IWorkspace> =
  mongoose.models.Workspace ||
  mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);

