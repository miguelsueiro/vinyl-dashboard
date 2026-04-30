import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

async function checkCount() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { count } = await supabase.from("records").select("*", { count: "exact", head: true });
  console.log("Total records:", count);
}
checkCount();
