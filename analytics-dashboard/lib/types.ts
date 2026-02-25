export interface Row {
  [key: string]: string | number | null;
}

export interface InferredSchema {
  allColumns: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  highCardinalityColumns: string[];
}

export interface KpiCard {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
}

export interface FilterState {
  dateRange: { from: string; to: string } | null;
  categoryFilters: Record<string, string[]>;
  numericRanges: Record<string, [number, number]>;
  searchTerm: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

export interface BarDataPoint {
  category: string;
  value: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  percentage?: number;
}

export interface OutlierResult {
  row: Row;
  column: string;
  value: number;
  zScore: number;
}

export interface InsightResult {
  topCategory: { name: string; column: string; value: number } | null;
  topGrowth: { name: string; column: string; growthRate: number } | null;
  outliers: OutlierResult[];
  summaryBullets: string[];
  totalRecords: number;
  dateRange: { from: string; to: string } | null;
}
