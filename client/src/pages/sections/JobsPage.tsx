import { useState } from "react";
import {
  Briefcase,
  ChevronRightIcon,
  Users,
  Package,
  Calendar,
  MapPin,
  FileText,
  Camera,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  Shield,
  ClipboardList,
  ArrowRight,
  Bell,
  Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { jobsApi } from "@/api";
import { AddIncidentModal } from "./AddIncidentModal";

type JobTab = "jobs" | "pullsheets" | "crew" | "incidents";

const jobTabs: { key: JobTab; label: string; icon: typeof Briefcase }[] = [
  { key: "jobs",       label: "Jobs",        icon: Briefcase },
  { key: "pullsheets", label: "Pull Sheets", icon: FileText },
  { key: "crew",       label: "Crew & Tasks",icon: Users },
  { key: "incidents",  label: "Incidents",   icon: Camera },
];

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-950/60 text-emerald-400",
  Scheduled: "bg-blue-950/60 text-blue-400",
  Completed: "bg-white/5 text-white/30",
  Pending: "bg-amber-950/60 text-amber-400",
  Dispatched: "bg-emerald-950/60 text-emerald-400",
  Draft: "bg-white/5 text-white/30",
  Returned: "bg-blue-950/60 text-blue-400",
  Open: "bg-red-950/60 text-red-400",
  Resolved: "bg-emerald-950/60 text-emerald-400",
};

const severityStyles: Record<string, string> = {
  High: "bg-red-500/10 text-red-400",
  Medium: "bg-amber-500/10 text-amber-400",
  Low: "bg-blue-500/10 text-blue-400",
};

const actionColors: Record<string, string> = {
  "Checked Out": "text-blue-400 bg-blue-500/10",
  Returned: "text-emerald-400 bg-emerald-500/10",
  "Reported Damage": "text-red-400 bg-red-500/10",
};

const priorityColors: Record<string, string> = {
  High: "bg-red-500/10 text-red-400",
  Medium: "bg-amber-500/10 text-amber-400",
  Low: "bg-blue-500/10 text-blue-400",
};

const taskStatusColors: Record<string, string> = {
  "In Progress": "text-[#FFFF00]",
  Pending: "text-white/30",
  Done: "text-emerald-400",
};

export const JobsPage = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<JobTab>("jobs");
  const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
  const [addIncidentOpen, setAddIncidentOpen] = useState(false);
  const { token } = useAppStore();
  const qc = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: jobsApi.getAll,
    enabled: !!token,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: jobsApi.getIncidents,
    enabled: !!token,
  });

  const createIncident = useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: Parameters<typeof jobsApi.createIncident>[1] }) =>
      jobsApi.createIncident(jobId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const { data: pullSheets = [] } = useQuery({
    queryKey: ["pull-sheets"],
    queryFn: jobsApi.getPullSheets,
    enabled: !!token,
  });

  const { data: crewData } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token,
  });

  const crewMembers      = crewData?.crew              ?? [];
  const myTasks          = crewData?.tasks             ?? [];
  const responsibilityLog = crewData?.responsibilityLog ?? [];

  const toggleJob = (id: string) => setExpandedJobs((p) => p.includes(id) ? p.filter((r) => r !== id) : [...p, id]);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-jobs">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-jobs-title">Jobs</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{(jobs as any[]).filter((j) => j.status === "active").length} Active</span>
          <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{(jobs as any[]).filter((j) => j.status === "scheduled").length} Scheduled</span>
          <span className="flex items-center gap-1 text-white/30"><span className="w-1.5 h-1.5 rounded-full bg-white/30" />{(jobs as any[]).filter((j) => j.status === "completed").length} Completed</span>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {jobTabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/30 hover:text-white/50"}`} data-testid={`tab-${t.key}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "jobs" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">Job</th>
                <th className="py-2.5 text-left font-semibold">Client</th>
                <th className="py-2.5 text-left font-semibold">Dates</th>
                <th className="py-2.5 text-left font-semibold">Stock</th>
                <th className="py-2.5 text-left font-semibold">Status</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {(jobs as any[]).flatMap((job) => {
                const start = new Date(job.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const end   = new Date(job.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const dateStr = start === end ? start : `${start} – ${end}`;
                const exp = expandedJobs.includes(job.id);
                const rows = [
                  <tr key={`j-${job.id}`} onClick={() => toggleJob(job.id)} className="bg-[#1a1a1a] hover:bg-[#222] cursor-pointer border-b border-white/[0.04] transition-colors" data-testid={`row-job-${job.id}`}>
                    <td className="py-2.5 pl-4"><div className="flex items-center gap-2"><ChevronRightIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${exp ? "rotate-90 text-[#FFFF00]" : "text-white/30"}`} /><span className="font-medium text-white/90">{job.name}</span></div></td>
                    <td className="py-2.5 text-white/50">{job.client}</td>
                    <td className="py-2.5 text-white/40 text-xs">{dateStr}</td>
                    <td className="py-2.5"><span className="text-white/25 text-xs">—</span></td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[job.status] ?? "bg-white/5 text-white/30"}`}>{job.status}</span></td>
                    <td className="py-2.5 pr-4 text-right text-[10px] text-[#FFFF00]/50 italic">{exp ? "Collapse" : "Expand"}</td>
                  </tr>,
                ];
                if (exp) {
                  rows.push(
                    <tr key={`jd-${job.id}`} className="animate-slide-down bg-[#131313] border-b border-white/[0.04]">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#FFFF00]/50 uppercase tracking-wider font-semibold"><MapPin className="w-3 h-3" />Location</div>
                            <p className="text-sm text-white/60">{job.location ?? "—"}</p>
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-white/30"><Calendar className="w-3 h-3" />{dateStr}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-[#FFFF00]/50 uppercase tracking-wider font-semibold"><Users className="w-3 h-3" />Crew &amp; Stock</div>
                            <p className="text-xs text-white/30">จะแสดงเมื่อ assign crew และ stock ให้งาน</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "pullsheets" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-[#FFFF00]/5 border border-[#FFFF00]/10 rounded-lg">
            <Smartphone className="w-4 h-4 text-[#FFFF00]" />
            <span className="text-xs text-[#FFFF00]/70">Pull sheets can be shared via LINE or exported as PDF for paperless operations</span>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 text-left font-semibold">Pull Sheet</th>
                  <th className="py-2.5 text-left font-semibold">Job</th>
                  <th className="py-2.5 text-left font-semibold">Items</th>
                  <th className="py-2.5 text-left font-semibold">Created</th>
                  <th className="py-2.5 text-left font-semibold">Assignee</th>
                  <th className="py-2.5 text-left font-semibold">Status</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pullSheets.map((ps) => (
                  <tr key={ps.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-pullsheet-${ps.id}`}>
                    <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{ps.id}</td>
                    <td className="py-2.5 text-white/60">{ps.job}</td>
                    <td className="py-2.5"><span className="font-bold text-white">{ps.items}</span></td>
                    <td className="py-2.5 text-white/30 text-xs">{new Date(ps.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2.5 text-white/50">{ps.assignee}</td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[ps.status]}`}>{ps.status}</span></td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-[#FFFF00] transition-colors" title="Share via LINE" data-testid={`button-share-line-${ps.id}`}><MessageSquare className="w-3.5 h-3.5" /></button>
                        <button className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white transition-colors" title="Export PDF" data-testid={`button-export-pdf-${ps.id}`}><FileText className="w-3.5 h-3.5" /></button>
                        <button className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-emerald-400 transition-colors" title="Send to crew" data-testid={`button-send-crew-${ps.id}`}><Send className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "crew" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-[#FFFF00]/5 border border-[#FFFF00]/10 rounded-lg">
            <Bell className="w-4 h-4 text-[#FFFF00]" />
            <span className="text-xs text-[#FFFF00]/70">Schedules and tasks are sent directly to crew via the notification system</span>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-7 bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFFF00]" />
                <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Crew & Assignments</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {crewMembers.map((crew) => (
                  <div key={crew.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors" data-testid={`crew-${crew.initials.toLowerCase()}`}>
                    <div className="w-8 h-8 rounded-full bg-[#FFFF00]/10 flex items-center justify-center text-xs font-bold text-[#FFFF00]/70">{crew.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-sm font-medium text-white/80">{crew.name}</span><span className="text-[10px] text-white/20">{crew.role}</span></div>
                      <div className="flex items-center gap-3 text-[11px] text-white/25 mt-0.5">
                        <span>Current: <span className={crew.currentJob !== "—" ? "text-emerald-400/70" : "text-white/20"}>{crew.currentJob}</span></span>
                        <span>Next: <span className="text-white/40">{crew.nextJob}</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs"><Package className="w-3 h-3 text-white/20" /><span className="text-white/50 font-medium">{crew.items}</span><span className="text-white/20">items</span></div>
                      <div className="flex items-center gap-1 text-[10px] text-white/20 mt-0.5"><CheckCircle2 className="w-3 h-3" />{crew.tasksToday} tasks</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-5 space-y-4">
              <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#FFFF00]" />
                  <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">My Tasks</span>
                  <span className="ml-auto text-[10px] text-white/20">{myTasks.filter((t) => t.status !== "Done").length} pending</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {myTasks.map((task) => (
                    <div key={task.id} className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${task.status === "Done" ? "opacity-50" : ""}`} data-testid={`task-${task.id}`}>
                      <div className="mt-0.5">
                        {task.status === "Done" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : task.status === "In Progress" ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#FFFF00] border-t-transparent animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className={`text-xs ${task.status === "Done" ? "line-through text-white/30" : "text-white/70"}`}>{task.title}</span><span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${priorityColors[task.priority]}`}>{task.priority}</span></div>
                        <span className="text-[10px] text-white/20">{task.due}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#FFFF00]" />
                  <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Responsibility Log</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {responsibilityLog.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`responsibility-${log.id}`}>
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${actionColors[log.action]}`}>
                        {log.action === "Checked Out" ? <ArrowRight className="w-3 h-3" /> : log.action === "Returned" ? <CheckCircle2 className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className={`text-[10px] font-semibold ${actionColors[log.action]?.split(" ")[0]}`}>{log.action}</span><span className="text-[9px] text-white/15">{log.time}</span></div>
                        <p className="text-xs text-white/50"><span className="text-white/70">{log.person}</span> — {log.items}</p>
                      </div>
                      {log.signature && <CheckCircle2 className="w-3 h-3 text-emerald-400/40" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="space-y-4">
          {addIncidentOpen && (
            <AddIncidentModal
              onClose={() => setAddIncidentOpen(false)}
              onSubmit={(jobId, data) => createIncident.mutate({ jobId, data })}
            />
          )}
          <div className="flex items-center gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-lg">
            <Camera className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300 flex-1">Crew can report damage on-site with photo evidence for full transparency</span>
            <button
              onClick={() => setAddIncidentOpen(true)}
              className="flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Report Incident
            </button>
          </div>
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="font-bold text-red-400 text-xs tracking-widest uppercase">Incident Reports</span>
              <span className="ml-auto text-[10px] text-white/20">{(incidents as any[]).filter((i) => i.status === "open").length} open</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(incidents as any[]).map((inc) => (
                <div key={inc.id} className="flex items-start gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors" data-testid={`incident-${inc.id}`}>
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${inc.status === "open" ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                    {inc.status === "open" ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-[#FFFF00]/60">{inc.id.slice(0, 8)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${severityStyles[inc.severity] ?? "bg-white/5 text-white/30"}`}>{inc.severity}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusStyles[inc.status] ?? "bg-white/5 text-white/30"}`}>{inc.status}</span>
                      {inc.hasPhoto && (
                        inc.photoUrl ? (
                          <a href={inc.photoUrl} target="_blank" rel="noopener noreferrer" title="View photo evidence" className="text-white/30 hover:text-[#FFFF00] transition-colors">
                            <Camera className="w-3 h-3" />
                          </a>
                        ) : (
                          <span title="Photo attached"><Camera className="w-3 h-3 text-white/20" /></span>
                        )
                      )}
                    </div>
                    <p className="text-sm text-white/60">{inc.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/20 mt-1">
                      <span>Asset: <span className="text-white/40">{inc.stockUnitId ?? "—"}</span></span>
                      <span>Job: <span className="text-white/40">{inc.jobId ?? "—"}</span></span>
                      <span>By: <span className="text-white/40">{inc.reporterId}</span></span>
                      <span>{new Date(inc.date).toLocaleDateString("en-GB")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
