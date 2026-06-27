"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

export async function saveStreamingUrl(formData: FormData) {
  const releaseId = formData.get("releaseId") as string;
  const url = formData.get("url") as string;

  if (!releaseId) return { success: false, error: "No ID provided" };

  const { data, error, count } = await supabase
    .from("records")
    .update({ streaming_url: url })
    .eq("discogs_release_id", parseInt(releaseId, 10))
    .select(); // We use select to confirm data came back

  if (error) {
    console.error("❌ Error Supabase:", error.message);
    return { success: false, error: error.message };
  }

  if (!data || data.length === 0) {
    console.error("⚠️ No se encontró el disco con ID:", releaseId);
    return { success: false, error: "No se encontró el disco en la DB." };
  }

  console.log("✅ Update exitoso para:", releaseId, "URL:", url);

  // Revalidamos
  revalidatePath("/");
  revalidatePath(`/release/${releaseId}`);

  return { success: true };
}

export async function createSmartFolder(name: string, rules: any) {
  if (!name) return { success: false, error: "El nombre es obligatorio" };

  const { data, error } = await supabase
    .from("smart_folders")
    .insert({ name, rules })
    .select();

  if (error) {
    console.error("❌ Error al crear carpeta inteligente:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true, folder: data?.[0] };
}

export async function updateSmartFolder(id: string, name: string, rules: any) {
  if (!id || !name) return { success: false, error: "ID y nombre son obligatorios" };

  const { data, error } = await supabase
    .from("smart_folders")
    .update({ name, rules })
    .eq("id", id)
    .select();

  if (error) {
    console.error("❌ Error al actualizar carpeta inteligente:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true, folder: data?.[0] };
}

export async function deleteSmartFolder(id: string) {
  if (!id) return { success: false, error: "No se proporcionó ID" };

  const { error } = await supabase
    .from("smart_folders")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("❌ Error al eliminar carpeta inteligente:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
