import React, { useCallback } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { UploadCloud, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface UploadAreaProps {
  onUpload: (file: File) => void;
  isProcessing?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onUpload, isProcessing }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt', '.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isProcessing
  } as any);

  const file = acceptedFiles[0];

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col items-center justify-center p-8 text-center bg-white/40 backdrop-blur-sm hover:bg-white/60",
          isDragActive ? "border-indigo-400 bg-indigo-50/50 scale-[1.02]" : "border-slate-200 hover:border-indigo-300",
          isProcessing && "opacity-50 cursor-not-allowed animate-pulse"
        )}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-indigo-600">Analyzing document...</p>
              <p className="text-xs text-slate-400 mt-1">Building your agenda</p>
            </motion.div>
          ) : file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-emerald-500 mt-1 font-medium">Ready to process</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                isDragActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
              )}>
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">
                {isDragActive ? "Drop it here!" : "Drop your agenda doc here"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, DOCX, TXT
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
