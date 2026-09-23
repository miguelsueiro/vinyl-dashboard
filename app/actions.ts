"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { ReglasCarpeta } from "@/lib/types";

// Estas acciones corren SOLO en el servidor ("use server"), así que usamos la
// service role key. La anon key viaja en el bundle del navegador y, con RLS
// activada, ya no tiene permiso de escritura.
const MISSING_CONFIG = "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: no se puede escribir en la base de datos.";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ " + MISSING_CONFIG);
    return null;
  }
  return createClient(url, key);
}

export async function saveStreamingUrl(formData: FormData) {
  const releaseId = formData.get("releaseId") as string;
  const url = formData.get("url") as string;

  if (!releaseId) return { success: false, error: "No ID provided" };

  const supabase = getSupabase();
  if (!supabase) return { success: false, error: MISSING_CONFIG };

  const { data, error } = await supabase
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

export async function createSmartFolder(name: string, rules: ReglasCarpeta) {
  if (!name) return { success: false, error: "El nombre es obligatorio" };

  const supabase = getSupabase();
  if (!supabase) return { success: false, error: MISSING_CONFIG };

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

export async function updateSmartFolder(id: string, name: string, rules: ReglasCarpeta) {
  if (!id || !name) return { success: false, error: "ID y nombre son obligatorios" };

  const supabase = getSupabase();
  if (!supabase) return { success: false, error: MISSING_CONFIG };

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

  const supabase = getSupabase();
  if (!supabase) return { success: false, error: MISSING_CONFIG };

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
