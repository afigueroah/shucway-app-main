// src/api/uploadFile.ts
import { RcFile } from "antd/es/upload";
import { supabase } from "./supabaseClient";

export const uploadFile = async (file?: RcFile, userId?: string): Promise<string | null> => {
  if (!file || !userId) return null;

  // Generar nombre de archivo único
  const ext = file.name.split('.').pop();
  const fileName = `${userId}/avatar-${Date.now()}.${ext}`;

  // Convertir archivo a ArrayBuffer para asegurar que se suba como binario
  const arrayBuffer = await file.arrayBuffer();
  const fileBlob = new Blob([arrayBuffer], { type: file.type });

  const { error } = await supabase.storage
    .from("user-img")
    .upload(fileName, fileBlob, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    console.error("Error al subir el archivo:", error.message);
    return null;
  }

  const { data } = supabase.storage.from("user-img").getPublicUrl(fileName);
  return data.publicUrl || null;
};
