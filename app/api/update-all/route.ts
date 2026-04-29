import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Trigger update logic (simplified for the API)
  // In a real production app, you might want to offload this to a background job
  // or use the script we created.
  
  return NextResponse.json({ success: true, message: "Update triggered" });
}
