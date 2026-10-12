"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api/v1";

export interface UploadedPhoto {
  id: string;
  url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    throw new Error("Not authenticated");
  }

  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(`${API_URL}/photos/upload`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Photo upload failed");
  }

  return response.json();
}
