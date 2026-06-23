import React, { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

// อัพโหลดไฟล์ขึ้น Supabase Storage bucket "attachments" แบบ namespaced ตามบริษัท/ประเภท
export async function uploadAttachment(file: File, folder: "maintenance" | "subrentals" | "incidents" | "stock-items" | "brands" | "avatars" | "job-expenses", companyId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${companyId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}

interface FileUploadFieldProps {
  label: string;
  folder: "maintenance" | "subrentals" | "incidents" | "stock-items" | "brands" | "avatars" | "job-expenses";
  companyId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

export const FileUploadField = ({ label, folder, companyId, value, onChange }: FileUploadFieldProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadAttachment(file, folder, companyId);
      onChange(url);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
          <button onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors">
            <X className="w-3 h-3" />
          </button>
          {isImage(value) ? (
            <img src={value} alt={label} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
          ) : (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/10">
              <FileText className="w-5 h-5 text-[#FFFF00]/60" />
            </div>
          )}
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#FFFF00]/70 hover:text-[#FFFF00] underline truncate flex-1">
            View attachment
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-white/10 hover:border-[#FFFF00]/30 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group min-h-[100px] disabled:cursor-wait"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-[#FFFF00]/60 animate-spin" />
              <span className="text-[11px] font-medium text-white/60">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-white/40 group-hover:text-white/60 transition-colors" />
              <span className="text-[11px] font-medium text-white/60 group-hover:text-white transition-colors text-center">Click to upload</span>
              <span className="text-[9px] text-white/40 flex items-center gap-1"><Paperclip className="w-2.5 h-2.5" />Image or PDF — max 20 MB</span>
            </>
          )}
        </button>
      )}

      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
};
