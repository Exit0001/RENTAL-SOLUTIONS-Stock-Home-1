// API functions — ทุกอย่างส่ง token อัตโนมัติจาก client.ts
// server อ่าน company_id จาก JWT เอง ไม่ต้องส่งแยก
import { api, fetchBlob } from "./client";
import type {
  Company, InsertCompany,
  StockItem, InsertStockItem,
  StockUnit, InsertStockUnit,
  Container, InsertContainer,
  Job, InsertJob,
  MaintenanceLog, InsertMaintenanceLog, InsertMaintenanceLogBatch,
  SubRental, InsertSubRental,
  Incident, InsertIncident,
  Brand, InsertBrand,
  Category, InsertCategory,
  SubCategory, InsertSubCategory,
  Location, InsertLocation,
  Position, InsertPosition,
  ContainerType, InsertContainerType,
  Quote, InsertQuote, Invoice, InsertInvoice,
  PullSheet, InsertPullSheet,
  JobCrew,
  Notification,
  JobExpense, InsertJobExpense,
  JobVehicle, InsertJobVehicle,
  ItemAccessory, InsertItemAccessory,
  JobTemplate, JobTemplateItem,
  EquipmentSet, EquipmentSetItem,
} from "@shared/schema";

// ─── Companies (ไม่ต้องการ auth) ─────────────────────────

export const companiesApi = {
  create:  (data: InsertCompany) => api.post<Company>("/companies", data),
  getById: (id: string)          => api.get<Company>(`/companies/${id}`),
};

// ─── Auth / Profile ───────────────────────────────────────

export type Me = {
  id: string;
  name: string;
  initials: string;
  role: string;
  companyId: string;
  companyName: string;
  avatarUrl: string | null;
};

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  role: "admin" | "manager" | "crew";
  email: string;
  avatarUrl: string | null;
};

export const authApi = {
  getMe:    () => api.get<Me>("/auth/me"),
  updateMe: (data: { name?: string; avatarUrl?: string | null }) => api.put<Me>("/auth/me", data),
  getTeam:  () => api.get<TeamMember[]>("/auth/team"),
  removeMember: (userId: string) => api.delete<{ message: string }>(`/auth/team/${userId}`),
  getCompany: () => api.get<Company>("/auth/company"),
  updateCompany: (data: { name?: string; lineChannelAccessToken?: string; lineGroupId?: string }) =>
    api.put<Company>("/auth/company", data),
};

// ─── Stock ────────────────────────────────────────────────

export type ScannedUnit    = StockUnit & { itemName: string; category: string };
export type StockUnitWithContainer = StockUnit & {
  containerId:   string | null;
  containerName: string | null;
  containerType: string | null;
};
export type PlannedJob         = { id: string; name: string; startDate: string | null; status: string };
export type UnitBooking        = { jobId: string; jobName: string; startDate: string | null; endDate: string | null; status: string };
export type StockUnitWithPlan  = StockUnitWithContainer & { plannedJob: PlannedJob | null; bookings: UnitBooking[] };
export type StockItemWithUnits = StockItem & { units: StockUnitWithPlan[]; availableCount?: number; plannedCount?: number; lastPosition?: string | null };
export type AssignedUnit        = StockUnit & { itemName: string; phase: "planned" | "prepared" | "dispatched" | "returned"; jobUnitId: string; position: string | null };
export type ItemAccessoryWithInfo = ItemAccessory & { accessoryName: string; availableCount: number };

export const stockApi = {
  getAll:         () => api.get<StockItem[]>("/stock"),
  getById:        (id: string) => api.get<StockItemWithUnits>(`/stock/${id}`),
  getAllWithUnits: () => api.get<StockItemWithUnits[]>("/stock/all-with-units"),
  create:         (data: Omit<InsertStockItem, "companyId">) => api.post<StockItem>("/stock", data),
  update:         (id: string, data: Partial<InsertStockItem>) => api.put<StockItem>(`/stock/${id}`, data),
  delete:         (id: string) => api.delete<void>(`/stock/${id}`),
  addUnit:        (itemId: string, data: Omit<InsertStockUnit, "companyId" | "stockItemId">) =>
                    api.post<StockUnit>(`/stock/${itemId}/units`, data),
  addUnitsBatch:  (itemId: string, units: Omit<InsertStockUnit, "companyId" | "stockItemId">[]) =>
                    api.post<StockUnit[]>(`/stock/${itemId}/units/batch`, { units }),
  updateUnit:     (unitId: string, data: Partial<InsertStockUnit>) =>
                    api.put<StockUnit>(`/stock/units/${unitId}`, data),
  scanBarcode:    (barcode: string) =>
                    api.get<ScannedUnit>(`/stock/units/scan/${encodeURIComponent(barcode)}`),
  // accessories
  getAllAccessoryLinks: () =>
    api.get<ItemAccessory[]>("/stock/accessories/all"),
  getAccessories: (itemId: string) =>
    api.get<ItemAccessoryWithInfo[]>(`/stock/${itemId}/accessories`),
  addAccessory:    (itemId: string, data: { accessoryStockItemId: string; quantityPerUnit?: number; required?: boolean }) =>
    api.post<ItemAccessory>(`/stock/${itemId}/accessories`, data),
  updateAccessory: (linkId: string, data: Partial<Pick<InsertItemAccessory, "quantityPerUnit" | "required">>) =>
    api.put<ItemAccessory>(`/stock/accessories/${linkId}`, data),
  removeAccessory: (linkId: string) =>
    api.delete<void>(`/stock/accessories/${linkId}`),
};

// ─── Containers ───────────────────────────────────────────

export type ContainerUnit     = StockUnit & { itemName: string; category: string };
export type ContainerWithItems = Container & {
  items: ContainerUnit[];
  jobId: string | null;
  jobName: string | null;
};

export const containersApi = {
  getAll:              () => api.get<ContainerWithItems[]>("/containers"),
  create:              (data: Omit<InsertContainer, "companyId">) => api.post<Container>("/containers", data),
  update:              (id: string, data: Partial<Pick<InsertContainer, "name" | "type" | "location" | "barcode" | "imageUrl">>) =>
                         api.put<Container>(`/containers/${id}`, data),
  toggleCheckout:      (id: string) => api.put<Container>(`/containers/${id}/checkout`, {}),
  delete:              (id: string) => api.delete<{ message: string }>(`/containers/${id}`),
  setUnits:            (id: string, unitIds: string[]) => api.post<void>(`/containers/${id}/units`, { unitIds }),
  addUnit:             (id: string, unitId: string) => api.post<void>(`/containers/${id}/units/add`, { unitId }),
  removeUnit:          (id: string, unitId: string) => api.delete<void>(`/containers/${id}/units/${unitId}`),
  downloadPackingSheet: () => fetchBlob("/containers/packing-sheet/pdf"),
};

// ─── Jobs ─────────────────────────────────────────────────

export type JobStockRow = {
  id:          string;
  jobId:       string;
  stockItemId: string;
  quantity:    number;
};

export type PullSheetRow = {
  id: string;
  status: string;
  createdAt: string;
  jobId: string | null;
  job: string;
  assignee: string;
  items: number;
};

export type CrewMember = {
  id: string;
  name: string;
  role: string;
  initials: string;
  currentJob: string;
  nextJob: string;
  items: number;
  tasksToday: number;
};

export type TaskItem = {
  id: string;
  title: string;
  job: string;
  priority: string;
  status: string;
  items: number;
  due: string;
};

export type ResponsibilityEntry = {
  id: string;
  action: string;
  person: string;
  items: string;
  job: string;
  time: string;
  signature: boolean;
};

export type CrewData = {
  crew: CrewMember[];
  tasks: TaskItem[];
  responsibilityLog: ResponsibilityEntry[];
};

export type JobStockItem    = { stockItemId: string; itemName: string; itemCategory: string; quantity: number };
export type JobDetail       = Job & { stock: JobStockItem[]; crew: unknown[]; pullSheets: unknown[] };
export type JobContainerRow = Container & { itemCount: number };
export type CrewType = "own_crew" | "freelancer" | "outsource" | "loader";
export type JobCrewMember   = { crewMemberId: string; name: string; type: CrewType; role: string | null; initials: string; hasAccount: boolean };
// Roster row types (backend crew_members / vehicles) — kept separate from the getCrew() `CrewMember` payload above
export type CrewMemberRow = {
  id: string; companyId: string; name: string; type: CrewType;
  phone: string | null; role: string | null; note: string | null;
  dayRate: string | null; userId: string | null; active: boolean; createdAt: string;
};
export type VehicleRow = {
  id: string; companyId: string; name: string; type: string | null;
  plate: string | null; capacity: string | null; note: string | null; active: boolean; createdAt: string;
};
export type JobBulkEntry    = { id: string; jobId: string; stockItemId: string; quantity: number; position: string | null };

export const jobsApi = {
  getAll:        () => api.get<Job[]>("/jobs"),
  getById:       (id: string) => api.get<JobDetail>(`/jobs/${id}`),
  create:        (data: Omit<InsertJob, "companyId">) => api.post<Job>("/jobs", data),
  duplicate:     (id: string, data?: { name?: string; startDate?: string; endDate?: string }) =>
                   api.post<Job>(`/jobs/${id}/duplicate`, data ?? {}),
  update:        (id: string, data: Partial<InsertJob>) => api.put<Job>(`/jobs/${id}`, data),
  delete:        (id: string) => api.delete<{ message: string }>(`/jobs/${id}`),
  addStock:      (jobId: string, items: { stockItemId: string; quantity: number }[]) =>
                   api.post<void>(`/jobs/${jobId}/stock`, { items }),
  getJobStock:   (jobId: string) => api.get<JobBulkEntry[]>(`/jobs/${jobId}/stock`),
  setJobStock:   (jobId: string, items: { stockItemId: string; quantity: number; position?: string | null }[]) =>
                   api.post<void>(`/jobs/${jobId}/stock`, { items }),
  getUnits:      (jobId: string) => api.get<AssignedUnit[]>(`/jobs/${jobId}/units`),
  setUnits:      (jobId: string, unitIds: string[]) =>
                   api.post<void>(`/jobs/${jobId}/units`, { unitIds }),
  updatePhase:   (jobId: string, stockUnitIds: string[], phase: "planned" | "prepared" | "dispatched" | "returned") =>
                   api.put<{ message: string; count: number }>(`/jobs/${jobId}/units/phase`, { stockUnitIds, phase }),
  setPositions:  (jobId: string, payload: { units?: { stockUnitId: string; position: string | null }[]; bulk?: { stockItemId: string; position: string | null }[] }) =>
                   api.put<{ message: string }>(`/jobs/${jobId}/positions`, payload),
  getPullSheets: () => api.get<PullSheetRow[]>("/jobs/pullsheets"),
  createPullSheet: (jobId: string, data: Omit<InsertPullSheet, "jobId">) =>
                   api.post<PullSheet>(`/jobs/${jobId}/pullsheets`, data),
  deletePullSheet: (id: string) => api.delete<void>(`/jobs/pullsheets/${id}`),
  downloadPullSheetPdf: (jobId: string) => fetchBlob(`/jobs/${jobId}/pullsheet/pdf`),
  downloadContainersPackingSheet: (jobId: string) => fetchBlob(`/jobs/${jobId}/packing-sheet/pdf`),
  loadContainer: (jobId: string, containerId: string) =>
    api.post<{ loaded: number; skipped: number }>(`/jobs/${jobId}/containers/${containerId}/load`, {}),
  getCrew:       () => api.get<CrewData>("/jobs/crew"),
  getIncidents:  () => api.get<Incident[]>("/jobs/all/incidents"),
  createIncident:(jobId: string, data: Omit<InsertIncident, "companyId" | "jobId">) =>
                   api.post<Incident>(`/jobs/${jobId}/incidents`, data),
  resolveIncident:(incidentId: string) => api.put<Incident>(`/jobs/incidents/${incidentId}`, {}),
  getContainers: (jobId: string) => api.get<JobContainerRow[]>(`/jobs/${jobId}/containers`),
  addContainer:  (jobId: string, containerId: string) =>
                   api.post<void>(`/jobs/${jobId}/containers`, { containerId }),
  removeContainer: (jobId: string, containerId: string) =>
                   api.delete<void>(`/jobs/${jobId}/containers/${containerId}`),
  applySet:      (jobId: string, setId: string) =>
                   api.post<{
                     message: string;
                     shortfall: { stockItemId: string; wanted: number; got: number }[];
                     addedUnits: { unitId: string; stockItemId: string }[];
                     addedBulkItems: { stockItemId: string; quantity: number }[];
                   }>(`/jobs/${jobId}/apply-set/${setId}`, {}),
  getJobCrew:    (jobId: string) => api.get<JobCrewMember[]>(`/jobs/${jobId}/crew`),
  assignCrew:    (jobId: string, crewMemberId: string, role?: string) => api.post<JobCrew>(`/jobs/${jobId}/crew`, { crewMemberId, role }),
  updateCrewRole:(jobId: string, crewMemberId: string, role: string | null) => api.put<JobCrew>(`/jobs/${jobId}/crew/${crewMemberId}`, { role }),
  unassignCrew:  (jobId: string, crewMemberId: string) => api.delete<void>(`/jobs/${jobId}/crew/${crewMemberId}`),
  getCrewCounts: (jobId: string) => api.get<{ type: CrewType; count: number }[]>(`/jobs/${jobId}/crew-counts`),
  setCrewCount:  (jobId: string, type: CrewType, count: number) => api.put<{ type: CrewType; count: number }>(`/jobs/${jobId}/crew-counts`, { type, count }),
};

// ─── Job Expenses (ค่าเด็กโหลด / ค่าเดินทาง-ส่งของ พร้อมสลิป) ──────

export const jobExpensesApi = {
  getForJob: (jobId: string) => api.get<JobExpense[]>(`/jobs/${jobId}/expenses`),
  create:    (jobId: string, data: Omit<InsertJobExpense, "companyId" | "jobId">) =>
               api.post<JobExpense>(`/jobs/${jobId}/expenses`, data),
  delete:    (expenseId: string) => api.delete<{ message: string }>(`/jobs/expenses/${expenseId}`),
};

// ─── Job Vehicles (รถที่ใช้ในงาน) ──────────────────────────

export type JobVehicleRow = JobVehicle & { plate: string | null; driverName: string | null };

export const jobVehiclesApi = {
  getForJob: (jobId: string) => api.get<JobVehicleRow[]>(`/jobs/${jobId}/vehicles`),
  create:    (jobId: string, data: { vehicleId?: string | null; driverCrewMemberId?: string | null; vehicleType?: string; note?: string | null }) =>
               api.post<JobVehicle>(`/jobs/${jobId}/vehicles`, data),
  update:    (vehicleId: string, data: { driverCrewMemberId?: string | null; note?: string | null }) =>
               api.put<JobVehicle>(`/jobs/vehicles/${vehicleId}`, data),
  delete:    (vehicleId: string) => api.delete<{ message: string }>(`/jobs/vehicles/${vehicleId}`),
};

// ─── Crew & Vehicle Roster (ทีมงาน & คลังรถ) ───────────────

export const crewApi = {
  getRoster: (type?: CrewType) => api.get<CrewMemberRow[]>(`/crew${type ? `?type=${type}` : ""}`),
  create:    (data: { name: string; type: CrewType; phone?: string | null; role?: string | null; note?: string | null; dayRate?: string | null; userId?: string | null }) =>
               api.post<CrewMemberRow>("/crew", data),
  update:    (id: string, data: Partial<{ name: string; type: CrewType; phone: string | null; role: string | null; note: string | null; dayRate: string | null; userId: string | null; active: boolean }>) =>
               api.put<CrewMemberRow>(`/crew/${id}`, data),
  delete:    (id: string) => api.delete<{ message: string }>(`/crew/${id}`),
  getMatrix: () => api.get<{ jobId: string; crewMemberId: string }[]>("/crew/matrix"),
};

export const vehiclesApi = {
  getRoster: () => api.get<VehicleRow[]>("/crew/vehicles"),
  create:    (data: { name: string; type?: string | null; plate?: string | null; capacity?: string | null; note?: string | null }) =>
               api.post<VehicleRow>("/crew/vehicles", data),
  update:    (id: string, data: Partial<{ name: string; type: string | null; plate: string | null; capacity: string | null; note: string | null; active: boolean }>) =>
               api.put<VehicleRow>(`/crew/vehicles/${id}`, data),
  delete:    (id: string) => api.delete<{ message: string }>(`/crew/vehicles/${id}`),
  getMatrix: () => api.get<{ jobId: string; vehicleId: string }[]>("/crew/vehicles/matrix"),
};

// ─── Job Sub-Rentals (อุปกรณ์ที่เช่าจากภายนอกสำหรับงานนี้) ──

export const jobSubRentalsApi = {
  getForJob: (jobId: string) => api.get<SubRental[]>(`/jobs/${jobId}/subrentals`),
  create:    (jobId: string, data: Omit<InsertSubRental, "companyId" | "jobId">) =>
               api.post<SubRental>(`/jobs/${jobId}/subrentals`, data),
  delete:    (subRentalId: string) => api.delete<{ message: string }>(`/jobs/subrentals/${subRentalId}`),
};

// ─── Finance ──────────────────────────────────────────────

export type ProjectCost = {
  project: string;
  jobId: string;
  revenue: number;
  staff: number;
  transport: number;
  subRentals: number;
  roi: number;
};

export type LossItem = {
  category: string;
  amount: string;
  items: number;
  trend: string;
  desc: string;
};

export type AutoBillingItem = {
  id: string;
  client: string;
  asset: string;
  type: string;
  amount: string;
  contract: string;
  status: string;
};

export type LossData = {
  lossItems: LossItem[];
  autoBillingItems: AutoBillingItem[];
};

export const financeApi = {
  getQuotes:     () => api.get<Quote[]>("/finance/quotes"),
  getInvoices:   () => api.get<Invoice[]>("/finance/invoices"),
  getCosting:    () => api.get<ProjectCost[]>("/finance/costing"),
  getLoss:       () => api.get<LossData>("/finance/loss"),
  createQuote:   (data: Omit<InsertQuote, "companyId">)   => api.post<Quote>("/finance/quotes", data),
  createInvoice: (data: Omit<InsertInvoice, "companyId">) => api.post<Invoice>("/finance/invoices", data),
  updateQuote:   (id: string, data: Partial<Quote>)   => api.put<Quote>(`/finance/quotes/${id}`, data),
  updateInvoice: (id: string, data: Partial<Invoice>) => api.put<Invoice>(`/finance/invoices/${id}`, data),
  downloadQuotePdf:   (id: string) => fetchBlob(`/finance/quotes/${id}/pdf`),
  downloadInvoicePdf: (id: string) => fetchBlob(`/finance/invoices/${id}/pdf`),
};

// ─── Maintenance ──────────────────────────────────────────

export type SubRentalWithJob = SubRental & { jobName: string };

export const maintenanceApi = {
  getAll:        () => api.get<MaintenanceLog[]>("/maintenance"),
  createBatch:   (data: InsertMaintenanceLogBatch) => api.post<MaintenanceLog[]>("/maintenance/batch", data),
  update:        (id: string, data: Partial<InsertMaintenanceLog>) => api.put<MaintenanceLog>(`/maintenance/${id}`, data),
  updateStatusBatch: (ids: string[], status: "in_progress" | "completed") =>
                   api.put<MaintenanceLog[]>("/maintenance/batch-status", { ids, status }),
  delete:        (id: string) => api.delete<{ message: string }>(`/maintenance/${id}`),
  deleteBatch:   (ids: string[]) => api.delete<{ message: string; count: number }>("/maintenance/batch", { ids }),
  getSubRentals: () => api.get<SubRentalWithJob[]>("/maintenance/subrentals"),
  updateSubRental:(id: string, data: Partial<InsertSubRental>) => api.put<SubRental>(`/maintenance/subrentals/${id}`, data),
};

// ─── Activity ─────────────────────────────────────────────

export const activityApi = {
  getAll: () => api.get("/activity"),
};

// ─── Stats (KPI หน้า Home) ────────────────────────────────

export type DashboardStats = {
  totalAssets:    number;
  activeJobs:     number;
  inMaintenance:  number;
  monthlyRevenue: string;
  recentActivity: any[];
};

export const statsApi = {
  get: () => api.get<DashboardStats>("/stats"),
};

// ─── Analytics (History page) ─────────────────────────────

export type AnalyticsData = {
  utilizationData: { category: string; pct: number }[];
  healthMetrics:   { overall: number; atRisk: number; maintenanceInProgress: number };
  revenueMonths:   { month: string; revenue: number; profit: number }[];
};

export const analyticsApi = {
  get: () => api.get<AnalyticsData>("/analytics"),
};

// ─── Catalog (Brands / Categories / Sub-Categories / Locations) ──

export const catalogApi = {
  getBrands:        () => api.get<Brand[]>("/catalog/brands"),
  createBrand:      (data: Omit<InsertBrand, "companyId">) => api.post<Brand>("/catalog/brands", data),
  updateBrand:      (id: string, data: Partial<Omit<InsertBrand, "companyId">>) => api.put<Brand>(`/catalog/brands/${id}`, data),
  deleteBrand:      (id: string) => api.delete<void>(`/catalog/brands/${id}`),

  getCategories:    () => api.get<Category[]>("/catalog/categories"),
  createCategory:   (data: Omit<InsertCategory, "companyId">) => api.post<Category>("/catalog/categories", data),
  deleteCategory:   (id: string) => api.delete<void>(`/catalog/categories/${id}`),

  getSubCategories: () => api.get<SubCategory[]>("/catalog/subcategories"),
  createSubCategory:(data: Omit<InsertSubCategory, "companyId">) => api.post<SubCategory>("/catalog/subcategories", data),
  deleteSubCategory:(id: string) => api.delete<void>(`/catalog/subcategories/${id}`),

  getLocations:     () => api.get<Location[]>("/catalog/locations"),
  createLocation:   (data: Omit<InsertLocation, "companyId">) => api.post<Location>("/catalog/locations", data),
  deleteLocation:   (id: string) => api.delete<void>(`/catalog/locations/${id}`),
  getPositions:     () => api.get<Position[]>("/catalog/positions"),
  createPosition:   (data: Omit<InsertPosition, "companyId">) => api.post<Position>("/catalog/positions", data),
  deletePosition:   (id: string) => api.delete<void>(`/catalog/positions/${id}`),

  getContainerTypes:   () => api.get<ContainerType[]>("/catalog/container-types"),
  createContainerType: (data: Omit<InsertContainerType, "companyId">) => api.post<ContainerType>("/catalog/container-types", data),
  deleteContainerType: (id: string) => api.delete<void>(`/catalog/container-types/${id}`),
};

// ─── Notifications ────────────────────────────────────────

export type AppNotification = Notification;

export const notificationsApi = {
  getAll:         () => api.get<AppNotification[]>("/notifications"),
  getUnreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead:       (id: string) => api.put<AppNotification>(`/notifications/${id}/read`, {}),
  markAllRead:    () => api.put<{ message: string }>("/notifications/read-all", {}),
};

// ─── Job Templates ────────────────────────────────────────

export type JobTemplateSummary = JobTemplate & { itemCount: number; totalQty: number };
export type JobTemplateItemDetail = JobTemplateItem & { itemName: string; trackingMode: "unit" | "bulk" };
export type JobTemplateDetail = JobTemplate & { items: JobTemplateItemDetail[] };

export const jobTemplatesApi = {
  getAll:      () => api.get<JobTemplateSummary[]>("/job-templates"),
  getById:     (id: string) => api.get<JobTemplateDetail>(`/job-templates/${id}`),
  create:      (data: { name: string; notes?: string; items: { stockItemId: string; quantity: number }[] }) =>
                 api.post<JobTemplate>("/job-templates", data),
  saveFromJob: (jobId: string, data: { name: string; notes?: string }) =>
                 api.post<JobTemplate & { itemCount: number }>(`/job-templates/from-job/${jobId}`, data),
  delete:      (id: string) => api.delete<{ message: string }>(`/job-templates/${id}`),
  createJob:   (id: string, data: Omit<InsertJob, "companyId">) =>
                 api.post<Job & { shortfall: { stockItemId: string; wanted: number; got: number }[] }>(`/job-templates/${id}/create-job`, data),
};

// ─── Equipment Sets (ชุดอุปกรณ์ / Kits) ────────────────────

export type EquipmentSetSummary = EquipmentSet & { itemCount: number; totalQty: number };
export type EquipmentSetItemDetail = EquipmentSetItem & {
  itemName: string; trackingMode: "unit" | "bulk"; unitName?: string | null; serialNumber?: string | null;
};
export type EquipmentSetDetail = EquipmentSet & { items: EquipmentSetItemDetail[] };
export type EquipmentSetItemInput = { stockItemId: string; quantity: number; unitId?: string | null };
export type ShortfallLine = { stockItemId: string; wanted: number; got: number };

export const equipmentSetsApi = {
  getAll:  () => api.get<EquipmentSetSummary[]>("/equipment-sets"),
  getById: (id: string) => api.get<EquipmentSetDetail>(`/equipment-sets/${id}`),
  create:  (data: { name: string; description?: string | null; imageUrl?: string | null; items: EquipmentSetItemInput[] }) =>
             api.post<EquipmentSet>("/equipment-sets", data),
  update:  (id: string, data: { name?: string; description?: string | null; imageUrl?: string | null; items?: EquipmentSetItemInput[] }) =>
             api.put<EquipmentSet>(`/equipment-sets/${id}`, data),
  delete:  (id: string) => api.delete<{ message: string }>(`/equipment-sets/${id}`),
};

// ─── Backup / Export (Admin only, company-scoped) ─────────

export const backupApi = {
  exportData: () => fetchBlob("/backup/export"),
};

// ─── Web Push ─────────────────────────────────────────────

export const pushApi = {
  getVapidKey: () => api.get<{ publicKey: string }>("/push/vapid-public-key"),
  subscribe:   (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
                 api.post<{ message: string }>("/push/subscribe", sub),
  unsubscribe: (endpoint: string) => api.post<{ message: string }>("/push/unsubscribe", { endpoint }),
};
