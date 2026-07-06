import type { ChangeEvent } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import type { JobAttachment } from "@app/shared/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAttachment, attachmentDownloadUrl } from "@/hooks/useAttachments";
import { formatFileSize } from "@/lib/utils";

interface JobAttachmentsFieldProps {
  jobId: string | undefined;
  attachments: JobAttachment[];
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}

export function JobAttachmentsField({
  jobId,
  attachments,
  pendingFiles,
  onPendingFilesChange,
}: JobAttachmentsFieldProps) {
  const deleteAttachment = useDeleteAttachment(jobId ?? "");

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onPendingFilesChange([...pendingFiles, ...files]);
    e.target.value = "";
  }

  function removePending(index: number) {
    onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบไฟล์นี้หรือไม่?")) return;
    try {
      await deleteAttachment.mutateAsync(id);
      toast.success("ลบไฟล์แล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไฟล์ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">เอกสารแนบ (Excel, PDF, รูปภาพ ฯลฯ)</Label>
      {(attachments.length > 0 || pendingFiles.length > 0) && (
        <ul className="space-y-1.5 rounded-md border p-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <a
                href={attachmentDownloadUrl(a.id)}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-primary hover:underline"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{a.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">({formatFileSize(a.fileSize)})</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => handleDelete(a.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {pendingFiles.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs">({formatFileSize(file.size)}) · รอบันทึก</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removePending(idx)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
        onChange={handleFilesSelected}
      />
    </div>
  );
}
