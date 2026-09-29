/**
 * FileUploadButton.tsx
 * Paperclip button that opens a file picker and uploads to the file server.
 * Returns upload result to parent via onUpload callback.
 */

import React, { useRef, useState } from 'react';
import { Paperclip, Loader2, X, Image, Film, Music, FileText } from 'lucide-react';
import { uploadChatFile, UploadResult, formatFileSize } from '../fileService';

interface Props {
  convId: string;
  onUpload: (result: UploadResult) => void;
  disabled?: boolean;
}

const ACCEPT_ALL = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
].join(',');

const FileUploadButton: React.FC<Props> = ({ convId, onUpload, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; size: number; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 500MB size guard
    if (file.size > 500 * 1024 * 1024) {
      setError('File is too large. Max 500MB.');
      return;
    }

    setPreview({ name: file.name, size: file.size, type: file.type });
    setError(null);
    setUploading(true);

    try {
      const result = await uploadChatFile(file, convId);
      onUpload(result);
      setPreview(null);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const TypeIcon = preview?.type.startsWith('image/') ? Image
    : preview?.type.startsWith('video/') ? Film
    : preview?.type.startsWith('audio/') ? Music
    : FileText;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ALL}
        onChange={handleFile}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Upload progress pill */}
      {(uploading || error) && (
        <div className={`absolute bottom-12 left-0 flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg text-xs font-bold whitespace-nowrap z-20 ${
          error
            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
        }`}>
          {uploading ? (
            <>
              <Loader2 size={12} className="animate-spin text-[#E31E24]" />
              {preview && <TypeIcon size={12} className="text-slate-400" />}
              <span className="max-w-[160px] truncate">{preview?.name}</span>
              <span className="text-slate-400">{preview ? formatFileSize(preview.size) : ''}</span>
            </>
          ) : (
            <>
              <span>{error}</span>
              <button onClick={() => setError(null)}><X size={12} /></button>
            </>
          )}
        </div>
      )}

      {/* Paperclip button */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={disabled || uploading}
        className={`p-3 rounded-2xl transition-all ${
          uploading
            ? 'text-[#E31E24] bg-red-50 dark:bg-red-900/20 cursor-not-allowed'
            : 'text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95'
        }`}
        title="Attach file (images, video, audio, documents — max 500MB)"
      >
        {uploading
          ? <Loader2 size={20} className="animate-spin" />
          : <Paperclip size={20} />
        }
      </button>
    </div>
  );
};

export default FileUploadButton;
