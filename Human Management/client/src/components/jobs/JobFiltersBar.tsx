import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilterStore } from "@/stores/filterStore";

export function JobFiltersBar() {
  const jobSearch = useFilterStore((s) => s.jobSearch);
  const jobStatus = useFilterStore((s) => s.jobStatus);
  const setJobSearch = useFilterStore((s) => s.setJobSearch);
  const setJobStatus = useFilterStore((s) => s.setJobStatus);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่องานหรือชื่อลูกค้า..."
          className="pl-8"
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
        />
      </div>
      <Select value={jobStatus ?? "all"} onValueChange={(v) => setJobStatus(v === "all" ? undefined : v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="ทุกสถานะ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกสถานะ</SelectItem>
          <SelectItem value="tentative">ยังไม่ยืนยัน</SelectItem>
          <SelectItem value="confirmed">ยืนยันแล้ว</SelectItem>
          <SelectItem value="completed">เสร็จสิ้น</SelectItem>
          <SelectItem value="cancelled">ยกเลิก</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
