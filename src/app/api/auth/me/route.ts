import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        user: null,
        dbConfigured: false,
      });
    }
    const user = await getCurrentUser();
    return NextResponse.json({
      user,
      dbConfigured: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

