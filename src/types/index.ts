// ========== Geography ==========
export interface Ward {
  id: string;
  name: string;
  number: number;
}

export interface District {
  id: string;
  name: string;
  state: string;
  center: LatLng;
  zoom: number;
  wards: Ward[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

// ========== Sensors ==========
export interface Sensor {
  id: string;
  name: string;
  location: LatLng;
  pm25: number;
  pm10: number;
  zone: number;
  ward: number;
  lastUpdated: string;
  isActive: boolean;
  /** Gas pollutant concentrations (µg/m³) — present only on multi-gas sensors */
  co?: number | null;
  no2?: number | null;
  so2?: number | null;
  o3?: number | null;
  nh3?: number | null;
  /** Meteorological parameters — present only when sensor reports weather */
  windSpeed?: number | null;
  rh?: number | null;
  temp?: number | null;
}

// ========== Heatmap ==========
export interface HeatmapPoint {
  lat: number;
  lng: number;
  value: number;
}

// ========== Issues ==========
export type IssueType = 'road_dust' | 'waste_burning' | 'traffic_congestion' | 'construction_dust' | 'industrial_emission' | 'crop_burning';

export type IssueStatus = 'new' | 'active' | 'done' | 'escalated' | 'rejected';

export type IssueSeverity = 'high' | 'medium' | 'low';

export interface Issue {
  id: string;
  type: IssueType;
  title: string;
  description: string;
  location: LatLng;
  zone: number;
  zone_id?: number | null;
  zoneName?: string | null;
  ward: number;
  wardNames?: string[];
  severity: IssueSeverity;
  status: IssueStatus;
  pm25: number;
  pm10: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  districtId: string;
  detectedBy?: string | null;
  wind?: string | null;
  sopReference?: { id: string; title: string; description: string };
  affectedWards?: string[];
  sourceContributors?: Array<{ source: string; percentage: number; issueType?: string }>;
}

// ========== Layers ==========
export type MapLayerType = 'pollution' | 'sensors' | 'hotspots' | 'airsheds' | 'admin_boundaries' | 'source_contributions' | 'forecast';

export interface MapLayerState {
  pollution: boolean;
  sensors: boolean;
  hotspots: boolean;
  airsheds: boolean;
  admin_boundaries: boolean;
  source_contributions: boolean;
  forecast: boolean;
  lucknow_boundary: boolean;
  zone_boundaries: boolean;
  ward_boundaries: boolean;
}

// ========== Hotspots ==========
export type HotspotMode = 'realtime' | 'alltime';

export interface Hotspot {
  id: string;
  location: LatLng;
  intensity: number;
  label: string;
  sensorId?: string;
  isHotspot?: boolean;
  conditionsMet?: number;
  maxConsecDays?: number;
  foe?: number;
  condition1?: boolean;
  condition2?: boolean;
  condition3?: boolean;
}

// ========== Airsheds ==========
export interface Airshed {
  id: string;
  name: string;
  boundary: LatLng[];
  avgPm25: number;
}

// ========== Source Contributions ==========
export interface SourceContribution {
  id: string;
  location: LatLng;
  sources: {
    label: string;
    percentage: number;
    color: string;
  }[];
}

// ========== Auth / RBAC ==========
export type UserRole = 'SuperAdmin' | 'Admin' | 'Officer' | 'AE' | 'JE';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  districtId: string;
  permissions: string[];
  wardIds?: number[];
  supervisorId?: string | null;
}

// ========== Notifications ==========
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'issue_new' | 'issue_update' | 'threshold_breach' | 'system';
  isRead: boolean;
  createdAt: string;
  issueId?: string;
}
