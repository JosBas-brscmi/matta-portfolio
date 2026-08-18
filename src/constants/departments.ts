// ============================================================
// Browave official department list (bilingual: EN 繁中)
// Ordered by convention: executive → market-facing → technology
// → production/operations → quality & support.
// The `value` (English) is what gets stored in the database.
// ============================================================

export interface Department {
  value: string
  label: string
}

export const DEPARTMENTS: Department[] = [
  // ---- Executive & administration 經營管理 ----
  { value: 'GM Office', label: 'GM Office 總經理辦公室' },
  { value: 'Administration', label: 'Administration 管理部' },
  { value: 'Finance and Accounting', label: 'Finance and Accounting 財務會計部' },

  // ---- Market-facing 市場面 ----
  { value: 'Marketing & Sales', label: 'Marketing & Sales 市場銷售部' },
  { value: 'Customer Service', label: 'Customer Service 客戶服務部' },

  // ---- Technology & engineering 技術面 ----
  { value: 'Research and Development', label: 'Research and Development 研究發展部' },
  { value: 'Product Technology', label: 'Product Technology 工程技術部' },
  { value: 'Industrial Engineering', label: 'Industrial Engineering 工業工程部' },

  // ---- Production & operations 生產面 ----
  { value: 'Production Department', label: 'Production Department 生產部' },
  { value: 'Production/Material Control', label: 'Production/Material Control 生產物料管理部' },
  { value: 'Material Resource', label: 'Material Resource 物料資源部' },
  { value: 'Manufacture Information', label: 'Manufacture Information 生產資訊部' },

  // ---- Quality & support 品質與支援 ----
  { value: 'Quality Assurance', label: 'Quality Assurance 品質保證部' },
  { value: 'Facility Service', label: 'Facility Service 廠務部' },
]

export const DEPARTMENT_LABEL: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.value, d.label]),
)
