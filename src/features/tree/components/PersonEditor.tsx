"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { Person } from "../model";
import { uploadPhoto, type UploadedPhoto } from "./BackendPhotoUploader";
import styles from "./personEditor.module.css";

interface PersonEditorProps {
  person: Person;
  treeId: string;
  onSave: (person: Person) => void;
  onCancel: () => void;
}

export function PersonEditor({ person, treeId, onSave, onCancel }: PersonEditorProps) {
  const [name, setName] = useState(person.name);
  const [photoUrl, setPhotoUrl] = useState(person.photoUrl?.toString() || "");
  const [notes, setNotes] = useState(person.notes || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useState<{ current: HTMLInputElement | null }>({ current: null })[0];

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploaded = await uploadPhoto(file);
      setPhotoUrl(uploaded.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const updated: Person = {
      ...person,
      name,
      photoUrl: photoUrl || undefined,
      notes: notes || undefined,
    };
    onSave(updated);
  };

  return (
    <div className={styles.editor}>
      <h3 className={styles.title}>Edit Person</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Photo</label>
          <div className={styles.photoSection}>
            {photoUrl && (
              <div className={styles.photoPreview}>
                <img src={photoUrl} alt="Person" className={styles.previewImage} />
                <button type="button" className={styles.removePhotoBtn} onClick={handleRemovePhoto}>
                  Remove
                </button>
              </div>
            )}
            <div className={styles.uploadArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className={styles.fileInput}
                disabled={isUploading}
              />
              {isUploading ? (
                <button type="button" className={styles.uploadBtn} disabled>
                  Uploading...
                </button>
              ) : (
                <button type="button" className={styles.uploadBtn}>
                  Upload Photo
                </button>
              )}
              {uploadError && <p className={styles.error}>{uploadError}</p>}
            </div>
            {photoUrl && !photoUrl.startsWith("http") && (
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className={styles.input}
                placeholder="Photo URL"
              />
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder="Additional notes..."
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.saveBtn}>
            Save
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
