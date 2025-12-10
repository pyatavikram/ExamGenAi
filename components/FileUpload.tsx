import React, { useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  files: File[];
  setFiles: (files: File[]) => void;
}

// Validation constants
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Validate a single file
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `${file.name}: Unsupported format. Use JPG, PNG, GIF, or WebP.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `${file.name}: Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE_MB}MB.` };
  }
  return { valid: true };
};

export const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles }) => {
  const [error, setError] = React.useState<string | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    setError(null);

    // Check total file count
    if (files.length + newFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed. You have ${files.length}.`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of newFiles) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }
      validFiles.push(file);
    }

    setFiles([...files, ...validFiles]);
  }, [files, setFiles]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const imageFiles = Array.from(e.dataTransfer.files).filter(
        (file: File) => file.type.startsWith('image/')
      );
      addFiles(imageFiles);
    }
  }, [addFiles]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      // Reset input to allow re-selecting the same file
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    setError(null);
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);

  return (
    <div className="w-full">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer relative"
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={onFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-full shadow-sm">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700">Click or drag handwritten pages</p>
            <p className="text-sm text-gray-500">JPG, PNG, WebP (Max {MAX_FILE_SIZE_MB}MB each, {MAX_FILES} files)</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {/* Summary bar */}
          <div className="flex justify-between items-center text-xs text-gray-500 px-1">
            <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
            <span>Total: {totalSizeMB} MB</span>
          </div>

          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};