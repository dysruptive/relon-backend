import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    this.bucketName = this.configService.get<string>('GCP_STORAGE_BUCKET');
    const keyFilename = this.configService.get<string>('GCP_KEY_FILE');

    // Use service account key file if provided, otherwise use ADC
    this.storage = new Storage(
      keyFilename
        ? {
            projectId,
            keyFilename,
          }
        : {
            projectId,
          },
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<{ fileName: string; gcpPath: string }> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileName = `${uuidv4()}-${file.originalname}`;
    const gcpPath = `${folder}/${fileName}`;
    const blob = bucket.file(gcpPath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        reject(err);
      });

      blobStream.on('finish', async () => {
        // Files remain private - no makePublic() call
        resolve({
          fileName,
          gcpPath,
        });
      });

      blobStream.end(file.buffer);
    });
  }

  async deleteFile(gcpPath: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcpPath);

    await file.delete();
  }

  async getSignedUrl(gcpPath: string, expiresInMinutes: number = 15): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcpPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return url;
  }

  async fileExists(gcpPath: string): Promise<boolean> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcpPath);

    const [exists] = await file.exists();
    return exists;
  }

  /**
   * Get a read stream for a file from GCS (for streaming to client)
   */
  getFileStream(gcpPath: string) {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcpPath);
    return file.createReadStream();
  }
}
