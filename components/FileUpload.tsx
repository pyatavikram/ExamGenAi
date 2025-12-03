import React, { useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FileUploadProps {
  files: File[];
  setFiles: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles }) => {
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter((file) => (file as File).type.startsWith('image/'));
      setFiles([...files, ...newFiles]);
    }
  }, [files, setFiles]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

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
          accept="image/*"
          onChange={onFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-full shadow-sm">
            <Upload className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700">Click or drag handwritten pages</p>
            <p className="text-sm text-gray-500">Supports JPG, PNG (Max 5MB)</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button onClick={() => removeFile(idx)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};