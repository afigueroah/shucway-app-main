import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middlewares/errorHandler.middleware';
import { UploadOptions, UploadResponse } from '../types';

// Tipo para archivos de Supabase Storage
interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
}

export class StorageService {
  // Subir archivo a Supabase Storage
  async uploadFile(
    file: Buffer | File,
    options: UploadOptions
  ): Promise<UploadResponse> {
    try {
      const { bucket, folder = '', fileName, contentType } = options;

      // Generar nombre de archivo único si no se proporciona
      const finalFileName = fileName || `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const filePath = folder ? `${folder}/${finalFileName}` : finalFileName;

      // Subir archivo usando Service Role Key (sin RLS)
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: contentType,
          upsert: false
        });

      if (error) {
        logger.error('Error al subir archivo a Storage:', error);
        throw new AppError('Error al subir archivo', 500);
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      logger.info(`Archivo subido exitosamente: ${filePath}`);

      return {
        path: data.path,
        publicUrl: publicUrlData.publicUrl
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en uploadFile:', error);
      throw new AppError('Error al subir archivo', 500);
    }
  }

  // Eliminar archivo de Supabase Storage
  async deleteFile(bucket: string, filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        logger.error('Error al eliminar archivo de Storage:', error);
        throw new AppError('Error al eliminar archivo', 500);
      }

      logger.info(`Archivo eliminado exitosamente: ${filePath}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en deleteFile:', error);
      throw new AppError('Error al eliminar archivo', 500);
    }
  }

  // Obtener URL pública de un archivo
  getPublicUrl(bucket: string, filePath: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Listar archivos en un bucket/carpeta
  async listFiles(bucket: string, folder?: string): Promise<StorageFile[]> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder || '', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        logger.error('Error al listar archivos de Storage:', error);
        throw new AppError('Error al listar archivos', 500);
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en listFiles:', error);
      throw new AppError('Error al listar archivos', 500);
    }
  }

  // Crear bucket (si no existe)
  async createBucketIfNotExists(bucketName: string, isPublic: boolean = true): Promise<void> {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        logger.error('Error al listar buckets:', listError);
        throw new AppError('Error al verificar buckets', 500);
      }

      const bucketExists = buckets?.some(b => b.name === bucketName);

      if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: isPublic,
          fileSizeLimit: 5242880 // 5MB
        });

        if (createError) {
          logger.error('Error al crear bucket:', createError);
          throw new AppError('Error al crear bucket', 500);
        }

        logger.info(`Bucket creado exitosamente: ${bucketName}`);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en createBucketIfNotExists:', error);
      throw new AppError('Error al crear bucket', 500);
    }
  }
}

export const storageService = new StorageService();
