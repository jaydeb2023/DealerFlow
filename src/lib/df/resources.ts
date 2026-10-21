// Config-driven CRUD. One generic route (/api/df/r/[resource]) serves all of these,
// with per-resource roles, writable-field whitelists, auto numbering and audit.
import type { DfRole } from './constants'
import { normMobile } from './util'

export interface ResourceCfg {
  table: string
  read: DfRole[]
  write: DfRole[]
  remove: DfRole[]
  select: string
  search?: string[]
  filters?: string[]
  order?: { col: string; asc?: boolean }
  fields: string[]
  required?: string[]
  numbering?: { counter: string; column: string; prefix: string; pad?: number }
  prepare?: (row: Record<string, any>) => Record<string, any>
  /** restrict what a role may see (e.g. a sales rep sees only their own dealers) */
  ownerColumn?: string
  noAudit?: boolean
}

const OFFICE: DfRole[] = ['sales_manager', 'sales_rep', 'warehouse', 'finance']   // admin is always allowed
const MGR: DfRole[] = ['sales_manager']

export const RESOURCES: Record<string, ResourceCfg> = {
  dealers: {
    table: 'df_dealers',
    read: ['sales_manager', 'sales_rep', 'finance'], write: MGR, remove: [],
    select: '*, rep:df_staff!df_dealers_rep_id_fkey(id,full_name), territory:df_territories(id,name), price_list:df_price_lists(id,name)',
    search: ['name', 'dealer_code', 'contact_person', 'phone', 'email', 'gstin'],
    filters: ['status', 'rep_id', 'territory_id', 'category'],
    order: { col: 'created_at' },
    ownerColumn: 'rep_id',
    fields: ['name', 'contact_person', 'phone', 'email', 'billing_address', 'shipping_address', 'gstin', 'rep_id', 'territory_id',
      'category', 'credit_limit', 'payment_terms_days', 'price_list_id', 'opening_balance', 'status', 'notes'],
    required: ['name'],
    numbering: { counter: 'dealer', column: 'dealer_code', prefix: 'DLR-', pad: 4 },
    prepare: r => { if ('phone' in r) r.phone_norm = normMobile(r.phone) || null; if (r.gstin) r.gstin = String(r.gstin).trim().toUpperCase(); return r },
  },
  products: {
    table: 'df_products',
    read: OFFICE, write: MGR, remove: [],
    select: '*, category:df_categories(id,name)',
    search: ['name', 'sku', 'brand', 'hsn'],
    filters: ['active', 'category_id', 'brand'],
    order: { col: 'name', asc: true },
    fields: ['sku', 'name', 'category_id', 'brand', 'description', 'unit', 'image_url', 'hsn', 'gst_rate', 'list_price', 'moq', 'reorder_level', 'active'],
    required: ['sku', 'name'],
  },
  categories: {
    table: 'df_categories', read: [...OFFICE, 'dealer'], write: MGR, remove: MGR,
    select: '*', search: ['name'], order: { col: 'name', asc: true }, fields: ['name'], required: ['name'],
  },
  territories: {
    table: 'df_territories', read: OFFICE, write: MGR, remove: MGR,
    select: '*', search: ['name', 'region'], order: { col: 'name', asc: true }, fields: ['name', 'region'], required: ['name'],
  },
  warehouses: {
    table: 'df_warehouses', read: OFFICE, write: ['warehouse'], remove: [],
    select: '*', search: ['name', 'code'], order: { col: 'name', asc: true }, filters: ['active'],
    fields: ['name', 'code', 'address', 'active'], required: ['name'],
  },
  price_lists: {
    table: 'df_price_lists', read: OFFICE, write: MGR, remove: [],
    select: '*', search: ['name'], order: { col: 'name', asc: true }, filters: ['active'],
    fields: ['name', 'discount_pct', 'active'], required: ['name'],
  },
  price_list_items: {
    table: 'df_price_list_items', read: OFFICE, write: MGR, remove: MGR,
    select: '*, product:df_products(id,sku,name,list_price,unit)', filters: ['price_list_id', 'product_id'],
    order: { col: 'id', asc: true }, fields: ['price_list_id', 'product_id', 'price'], required: ['price_list_id', 'product_id', 'price'],
  },
  visits: {
    table: 'df_visits', read: ['sales_manager', 'sales_rep'], write: ['sales_manager', 'sales_rep'], remove: MGR,
    select: '*, dealer:df_dealers(id,name,dealer_code), rep:df_staff!df_visits_rep_id_fkey(id,full_name)',
    filters: ['dealer_id', 'rep_id', 'kind', 'followup_done'], search: ['notes', 'outcome'],
    order: { col: 'visited_at' }, ownerColumn: 'rep_id',
    fields: ['dealer_id', 'rep_id', 'kind', 'outcome', 'notes', 'visited_at', 'next_followup_at', 'followup_done'],
    required: ['dealer_id'],
  },
  targets: {
    table: 'df_targets', read: ['sales_manager', 'sales_rep'], write: MGR, remove: MGR,
    select: '*, rep:df_staff!df_targets_rep_id_fkey(id,full_name)', filters: ['rep_id', 'period'],
    order: { col: 'period' }, ownerColumn: 'rep_id',
    fields: ['rep_id', 'period', 'sales_target', 'collection_target'], required: ['rep_id', 'period'],
  },
  enquiries: {
    table: 'df_enquiries', read: ['sales_manager', 'sales_rep'], write: ['sales_manager', 'sales_rep'], remove: [],
    select: '*, dealer:df_dealers(id,name,dealer_code)', filters: ['status', 'dealer_id'], order: { col: 'created_at' },
    fields: ['status', 'reply'],
  },
  stock_movements: {
    table: 'df_stock_movements', read: ['sales_manager', 'warehouse', 'finance'], write: [], remove: [],
    select: '*, product:df_products(id,sku,name,unit), warehouse:df_warehouses(id,name)', filters: ['product_id', 'warehouse_id', 'kind'],
    order: { col: 'created_at' }, fields: [],
  },
  audit: {
    table: 'df_audit', read: [], write: [], remove: [],
    select: '*', filters: ['table_name', 'action'], search: ['actor_email', 'table_name'], order: { col: 'created_at' }, fields: [], noAudit: true,
  },
}

/** Friendly text for the common database errors. */
export function dbMessage(e: { message: string; code?: string }): string {
  if (e.code === '23505') return 'That already exists (a code, name or number must be unique).'
  if (e.code === '23503') return 'This record is used elsewhere, so it cannot be removed. Mark it inactive instead.'
  if (e.code === '23514') return 'One of the numbers is out of range. Please check the values.'
  if (e.code === '23502') return 'A required field is missing.'
  return e.message
}
