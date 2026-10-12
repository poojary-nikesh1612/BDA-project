import { NextResponse } from "next/server";
import { invalidateCurrentSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

export async function POST() {
  try {
    await invalidateCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

