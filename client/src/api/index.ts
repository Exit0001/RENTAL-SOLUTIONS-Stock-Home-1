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
  ContainerType, InsertContainerType,
  Quote, InsertQuote, Invoice, InsertInvoice,
  PullSheet, InsertPullSheet,
  JobCrew,
  Notification,
  JobExpense, InsertJobExpense,
  JobVehicle, InsertJobVehicle,
  ItemAccessory, InsertItemAccessory,
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
export type StockItemWithUnits  = StockItem & { units: StockUnitWithContainer[]; availableCount?: number };
export type AssignedUnit        = StockUnit & { itemName: string; phase: "planned" | "prepared" | "dispatched"; jobUnitId: string };
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
  getAll:         () => api.get<ContainerWithItems[]>("/containers"),
  create:         (data: Omit<InsertContainer, "companyId">) => api.post<Container>("/containers", data),
  toggleCheckout: (id: string) => api.put<Container>(`/containers/${id}/checkout`, {}),
  delete:         (id: string) => api.delete<{ message: string }>(`/containers/${id}`),
  setUnits:       (id: string, unitIds: string[]) => api.post<void>(`/containers/${id}/units`, { unitIds }),
};

// ─── Jobs ─────────────────────────────────────────────────

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
export type JobCrewMember   = { userId: string; name: string; initials: string; role: string };
export type JobBulkEntry    = { id: string; jobId: string; stockItemId: string; quantity: number };

export const jobsApi = {
  getAll:        () => api.get<Job[]>("/jobs"),
  getById:       (id: string) => api.get<JobDetail>(`/jobs/${id}`),
  create:        (data: Omit<InsertJob, "companyId">) => api.post<Job>("/jobs", data),
  update:        (id: string, data: Partial<InsertJob>) => api.put<Job>(`/jobs/${id}`, data),
  delete:        (id: string) => api.delete<{ message: string }>(`/jobs/${id}`),
  addStock:      (jobId: string, items: { stockItemId: string; quantity: number }[]) =>
                   api.post<void>(`/jobs/${jobId}/stock`, { items }),
  getJobStock:   (jobId: string) => api.get<JobBulkEntry[]>(`/jobs/${jobId}/stock`),
  setJobStock:   (jobId: string, items: { stockItemId: string; quantity: number }[]) =>
                   api.post<void>(`/jobs/${jobId}/stock`, { items }),
  getUnits:      (jobId: string) => api.get<AssignedUnit[]>(`/jobs/${jobId}/units`),
  setUnits:      (jobId: string, unitIds: string[]) =>
                   api.post<void>(`/jobs/${jobId}/units`, { unitIds }),
  updatePhase:   (jobId: string, stockUnitIds: string[], phase: "planned" | "prepared" | "dispatched") =>
                   api.put<{ message: string; count: number }>(`/jobs/${jobId}/units/phase`, { stockUnitIds, phase }),
  getPullSheets: () => api.get<PullSheetRow[]>("/jobs/pullsheets"),
  createPullSheet: (jobId: string, data: Omit<InsertPullSheet, "jobId">) =>
                   api.post<PullSheet>(`/jobs/${jobId}/pullsheets`, data),
  deletePullSheet: (id: string) => api.delete<void>(`/jobs/pullsheets/${id}`),
  downloadPullSheetPdf: (jobId: string) => fetchBlob(`/jobs/${jobId}/pullsheet/pdf`),
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
  getCrewMatrix: () => api.get<{ jobId: string; userId: string }[]>("/jobs/crew-matrix"),
  getJobCrew:    (jobId: string) => api.get<JobCrewMember[]>(`/jobs/${jobId}/crew`),
  assignCrew:    (jobId: string, userId: string) => api.post<JobCrew>(`/jobs/${jobId}/crew`, { userId }),
  unassignCrew:  (jobId: string, userId: string) => api.delete<void>(`/jobs/${jobId}/crew/${userId}`),
};

// ─── Job Expenses (ค่าเด็กโหลด / ค่าเดินทาง-ส่งของ พร้อมสลิป) ──────

export const jobExpensesApi = {
  getForJob: (jobId: string) => api.get<JobExpense[]>(`/jobs/${jobId}/expenses`),
  create:    (jobId: string, data: Omit<InsertJobExpense, "companyId" | "jobId">) =>
               api.post<JobExpense>(`/jobs/${jobId}/expenses`, data),
  delete:    (expenseId: string) => api.delete<{ message: string }>(`/jobs/expenses/${expenseId}`),
};

// ─── Job Vehicles (รถที่ใช้ในงาน) ──────────────────────────

export const jobVehiclesApi = {
  getForJob: (jobId: string) => api.get<JobVehicle[]>(`/jobs/${jobId}/vehicles`),
  create:    (jobId: string, data: Omit<InsertJobVehicle, "companyId" | "jobId">) =>
               api.post<JobVehicle>(`/jobs/${jobId}/vehicles`, data),
  delete:    (vehicleId: string) => api.delete<{ message: string }>(`/jobs/vehicles/${vehicleId}`),
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

export const maintenanceApi = {
  getAll:        () => api.get<MaintenanceLog[]>("/maintenance"),
  createBatch:   (data: InsertMaintenanceLogBatch) => api.post<MaintenanceLog[]>("/maintenance/batch", data),
  update:        (id: string, data: Partial<InsertMaintenanceLog>) => api.put<MaintenanceLog>(`/maintenance/${id}`, data),
  updateStatusBatch: (ids: string[], status: "in_progress" | "completed") =>
                   api.put<MaintenanceLog[]>("/maintenance/batch-status", { ids, status }),
  delete:        (id: string) => api.delete<{ message: string }>(`/maintenance/${id}`),
  deleteBatch:   (ids: string[]) => api.delete<{ message: string; count: number }>("/maintenance/batch", { ids }),
  getSubRentals: () => api.get<SubRental[]>("/maintenance/subrentals"),
  createSubRental:(data: Omit<InsertSubRental, "companyId">) => api.post<SubRental>("/maintenance/subrentals", data),
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

// ─── Web Push ─────────────────────────────────────────────

export const pushApi = {
  getVapidKey: () => api.get<{ publicKey: string }>("/push/vapid-public-key"),
  subscribe:   (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
                 api.post<{ message: string }>("/push/subscribe", sub),
  unsubscribe: (endpoint: string) => api.post<{ message: string }>("/push/unsubscribe", { endpoint }),
};
