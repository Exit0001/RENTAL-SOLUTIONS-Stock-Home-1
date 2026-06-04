// ข้อมูลทั้งหมดของหน้า Jobs

export type StaffMember = {
  name: string;
  role: string;
};

export type StockAssignment = {
  name: string;
  qty: number;
};

export type Job = {
  id: number;
  name: string;
  client: string;
  start: string;
  end: string;
  location: string;
  stockItems: number;
  status: string;
  staff: StaffMember[];
  stock: StockAssignment[];
};

export type PullSheet = {
  id: string;
  job: string;
  items: number;
  created: string;
  status: string;
  assignee: string;
};

export type CrewMember = {
  name: string;
  role: string;
  initials: string;
  currentJob: string;
  items: number;
  nextJob: string;
  tasksToday: number;
};

export type Task = {
  id: number;
  title: string;
  job: string;
  priority: string;
  status: string;
  items: number;
  due: string;
};

export type ResponsibilityLog = {
  id: number;
  action: string;
  person: string;
  items: string;
  job: string;
  time: string;
  signature: boolean;
};

export type Incident = {
  id: string;
  asset: string;
  job: string;
  reporter: string;
  date: string;
  desc: string;
  status: string;
  severity: string;
  hasPhoto: boolean;
};

// --- ข้อมูลจริง ---

export const jobs: Job[] = [
  {
    id: 1, name: "Festival Sound 2026", client: "Festival Sound Co.", start: "18 Mar", end: "20 Mar",
    location: "Victoria Park, London", stockItems: 48, status: "Active",
    staff: [{ name: "James Wilson", role: "Lead Engineer" }, { name: "Sarah Chen", role: "Sound Tech" }, { name: "Mike Torres", role: "Rigger" }],
    stock: [{ name: "J8 Loudspeaker", qty: 24 }, { name: "GSL8 Loudspeaker", qty: 10 }, { name: "SL-Sub", qty: 8 }, { name: "XLR Cable 20m", qty: 6 }],
  },
  {
    id: 2, name: "Corporate Gala", client: "Corporate Events Inc.", start: "22 Mar", end: "22 Mar",
    location: "The Dorchester", stockItems: 18, status: "Active",
    staff: [{ name: "Emma Davis", role: "Lead Engineer" }, { name: "Tom Baker", role: "Sound Tech" }],
    stock: [{ name: "Shure SM58", qty: 8 }, { name: "DI Box", qty: 6 }, { name: "Speaker Cable 10m", qty: 4 }],
  },
  {
    id: 3, name: "Tech Conference AV", client: "Tech Conference Ltd", start: "25 Mar", end: "27 Mar",
    location: "ExCeL London", stockItems: 32, status: "Scheduled",
    staff: [{ name: "James Wilson", role: "Lead Engineer" }, { name: "Alex Morgan", role: "AV Tech" }],
    stock: [{ name: "L-Acoustics A15", qty: 12 }, { name: "Wireless Mic Kit", qty: 8 }, { name: "LED Panel", qty: 8 }, { name: "Video Switcher", qty: 4 }],
  },
  {
    id: 4, name: "City Park Concert", client: "City Council", start: "5 Apr", end: "5 Apr",
    location: "Hyde Park", stockItems: 56, status: "Scheduled",
    staff: [{ name: "James Wilson", role: "Lead" }, { name: "Mike Torres", role: "Rigger" }, { name: "Emma Davis", role: "Sound" }, { name: "Alex Morgan", role: "AV" }],
    stock: [{ name: "J8 Loudspeaker", qty: 24 }, { name: "SL-Sub", qty: 16 }, { name: "Stage Monitor", qty: 8 }, { name: "XLR Cable 20m", qty: 8 }],
  },
  {
    id: 5, name: "Wedding Reception", client: "Wedding Bliss", start: "10 Mar", end: "10 Mar",
    location: "Kew Gardens", stockItems: 14, status: "Completed",
    staff: [{ name: "Sarah Chen", role: "Sound Tech" }, { name: "Tom Baker", role: "DJ Tech" }],
    stock: [{ name: "SM58", qty: 4 }, { name: "QSC K12.2", qty: 4 }, { name: "Sub 18\"", qty: 2 }, { name: "LED Uplighter", qty: 4 }],
  },
];

export const pullSheets: PullSheet[] = [
  { id: "PS-007", job: "Tech Conference AV",  items: 32, created: "16 Mar 2026", status: "Pending",    assignee: "James Wilson" },
  { id: "PS-006", job: "City Park Concert",   items: 56, created: "14 Mar 2026", status: "Draft",      assignee: "—" },
  { id: "PS-005", job: "Festival Sound 2026", items: 48, created: "12 Mar 2026", status: "Dispatched", assignee: "Mike Torres" },
  { id: "PS-004", job: "Corporate Gala",      items: 18, created: "11 Mar 2026", status: "Dispatched", assignee: "Emma Davis" },
  { id: "PS-003", job: "Wedding Reception",   items: 14, created: "8 Mar 2026",  status: "Returned",   assignee: "Sarah Chen" },
];

export const crewMembers: CrewMember[] = [
  { name: "James Wilson", role: "Lead Engineer", initials: "JW", currentJob: "Festival Sound 2026", items: 24, nextJob: "Tech Conference", tasksToday: 3 },
  { name: "Sarah Chen",   role: "Sound Tech",    initials: "SC", currentJob: "—",                   items: 0,  nextJob: "Festival Sound",  tasksToday: 1 },
  { name: "Mike Torres",  role: "Rigger",        initials: "MT", currentJob: "Festival Sound 2026", items: 16, nextJob: "City Park Concert",tasksToday: 4 },
  { name: "Emma Davis",   role: "Lead Engineer", initials: "ED", currentJob: "Corporate Gala",      items: 18, nextJob: "City Park Concert",tasksToday: 2 },
  { name: "Tom Baker",    role: "Sound Tech",    initials: "TB", currentJob: "—",                   items: 0,  nextJob: "—",               tasksToday: 0 },
  { name: "Alex Morgan",  role: "AV Tech",       initials: "AM", currentJob: "—",                   items: 0,  nextJob: "Tech Conference", tasksToday: 1 },
];

export const myTasks: Task[] = [
  { id: 1, title: "Load J8 Loudspeakers (24x) onto truck",         job: "Festival Sound 2026", priority: "High",   status: "In Progress", items: 24, due: "16 Mar, 14:00" },
  { id: 2, title: "Check & test wireless mic kits",                 job: "Festival Sound 2026", priority: "Medium", status: "Pending",     items: 8,  due: "16 Mar, 16:00" },
  { id: 3, title: "Verify sub-rental returns from Partner Audio",   job: "—",                   priority: "Medium", status: "Pending",     items: 4,  due: "17 Mar, 10:00" },
  { id: 4, title: "Prep DI box case for Corporate Gala",            job: "Corporate Gala",      priority: "Low",    status: "Pending",     items: 6,  due: "18 Mar, 09:00" },
  { id: 5, title: "Submit incident report for J8-004 damage",       job: "Festival Sound 2026", priority: "High",   status: "Done",        items: 1,  due: "15 Mar, 17:00" },
];

export const responsibilityLog: ResponsibilityLog[] = [
  { id: 1, action: "Checked Out",    person: "James Wilson", items: "24x J8 Loudspeaker",     job: "Festival Sound 2026", time: "16 Mar, 09:15", signature: true },
  { id: 2, action: "Checked Out",    person: "Mike Torres",  items: "8x SL-Sub",               job: "Festival Sound 2026", time: "16 Mar, 09:30", signature: true },
  { id: 3, action: "Returned",       person: "Sarah Chen",   items: "4x QSC K12.2",            job: "Wedding Reception",   time: "15 Mar, 22:30", signature: true },
  { id: 4, action: "Reported Damage",person: "Mike Torres",  items: "1x J8-004 (driver cone)", job: "Festival Sound 2026", time: "15 Mar, 16:20", signature: true },
];

export const incidents: Incident[] = [
  { id: "INC-012", asset: "J8-004",    job: "Festival Sound 2026", reporter: "Mike Torres", date: "15 Mar 2026", desc: "Driver cone damaged during load-in. Possible drop impact.",     status: "Open",     severity: "High",   hasPhoto: true },
  { id: "INC-011", asset: "XLR20-012", job: "Corporate Gala",      reporter: "Emma Davis",  date: "14 Mar 2026", desc: "Connector pin 2 broken. Cable still intermittently works.",      status: "Resolved", severity: "Low",    hasPhoto: true },
  { id: "INC-010", asset: "SM58-008",  job: "Wedding Reception",   reporter: "Tom Baker",   date: "10 Mar 2026", desc: "Mic grille dented after being dropped. Audio unaffected.",       status: "Resolved", severity: "Medium", hasPhoto: false },
];
