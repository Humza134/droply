"use client";

import {
  upload,
} from "@imagekit/next";
import { useState } from "react";

interface FileUploadProps {
  onSuccess: (res: { url: string; thumbnailUrl?: string | null; }) => void;
  onProgress?: (progress: number) => void;
}

const FileUpload = ({ onSuccess, onProgress }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File) => {
    const allowedTypes = [
      // images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      // pdf
      "application/pdf",
      // csv
      "text/csv",
      "application/vnd.ms-excel",
      "application/csv",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Only image, PDF or CSV files are allowed");
      return false;
    }
    const maxSizeBytes = 50 * 1024 * 1024; // for example 50MB max
    if (file.size > maxSizeBytes) {
      setError("File size must be less than 50 MB");
      return false;
    }
    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    if (!validateFile(file)) return;

    setUploading(true);

    try {
      // 1. Get auth params from your backend
      const authRes = await fetch("/api/imagekit-auth");
      const auth = await authRes.json();
      if (!auth.signature || !auth.token) {
        throw new Error("ImageKit auth failed");
      }

      // 2. Upload file via ImageKit
      const res = await upload({
        file,
        fileName: file.name,
        publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
        signature: auth.signature,
        expire: auth.expire,
        token: auth.token,
        onProgress: (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(Math.round(percent));
          }
        },
      });

      // Ensure we have a URL from the upload response
      if (!res || !res.url) {
        throw new Error("Upload did not return a URL");
      }

      // Build thumbnail URL if needed (for images)
      let thumbnailUrl: string | null = null;
      if (file.type.startsWith("image/")) {
        thumbnailUrl = `${res.url}?tr=w-300,h-300,cm-extract`;
      }

      // 3. Call onSuccess with result
      onSuccess({
        url: res.url,
        thumbnailUrl,
      });

    } catch (err) {
      console.error("Upload failed", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*,application/pdf,text/csv"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <div>Uploading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default FileUpload;
