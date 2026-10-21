// Roles, navigation, statuses and order workflow rules shared by browser and server.

export const BRAND = { name: 'DealerFlow AI', maker: 'Evynta', tagline: 'Simplify Distribution. Accelerate Growth.' }

export type DfRole = 'admin' | 'sales_manager' | 'sales_rep' | 'warehouse' | 'finance' | 'dealer'
export const STAFF_ROLES: DfRole[] = ['admin', 'sales_manager', 'sales_rep', 'warehouse', 'finance']
export const ALL_ROLES: DfRole[] = [...STAFF_ROLES, 'dealer']

export const ROLE_LABEL: Record<DfRole, string> = {
  admin: 'Company owner / admin', sales_manager: 'Sales manager', sales_rep: 'Sales representative',
  warehouse: 'Warehouse manager', finance: 'Accounts / finance', dealer: 'Dealer',
}

export interface NavItem { group: string; href: string; label: string; icon: string; roles: DfRole[] }
const OFFICE: DfRole[] = ['admin', 'sales_manager', 'sales_rep', 'warehouse', 'finance']
export const NAV: NavItem[] = [
  { group: 'Overview', href: '', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin', 'sales_manager', 'sales_rep', 'warehouse', 'finance'] },
  { group: 'Sales', href: '/orders', label: 'Orders', icon: 'ShoppingCart', roles: ['admin', 'sales_manager', 'sales_rep', 'warehouse', 'finance'] },
  { group: 'Sales', href: '/dealers', label: 'Dealers', icon: 'Users', roles: ['admin', 'sales_manager', 'sales_rep', 'finance'] },
  { group: 'Sales', href: '/team', label: 'Sales team', icon: 'Briefcase', roles: ['admin', 'sales_manager', 'sales_rep'] },
  { group: 'Catalogue & stock', href: '/products', label: 'Products', icon: 'Package', roles: ['admin', 'sales_manager', 'sales_rep', 'warehouse', 'finance'] },
  { group: 'Catalogue & stock', href: '/inventory', label: 'Inventory', icon: 'Boxes', roles: ['admin', 'sales_manager', 'warehouse'] },
  { group: 'Catalogue & stock', href: '/dispatch', label: 'Dispatch', icon: 'Truck', roles: ['admin', 'sales_manager', 'warehouse'] },
  { group: 'Money', href: '/invoices', label: 'Invoices', icon: 'FileText', roles: ['admin', 'sales_manager', 'finance'] },
  { group: 'Money', href: '/payments', label: 'Payments', icon: 'Wallet', roles: ['admin', 'finance', 'sales_manager'] },
  { group: 'Insights', href: '/reports', label: 'Reports', icon: 'BarChart3', roles: ['admin', 'sales_manager', 'warehouse', 'finance'] },
  { group: 'Insights', href: '/assistant', label: 'AI assistant', icon: 'Sparkles', roles: ['admin', 'sales_manager', 'warehouse', 'finance'] },
  { group: 'Account', href: '/notifications', label: 'Notifications', icon: 'Bell', roles: OFFICE },
  { group: 'Account', href: '/settings', label: 'Settings', icon: 'Settings', roles: ['admin'] },
  // dealer portal
  { group: 'Dealer portal', href: '/portal', label: 'Place an order', icon: 'ShoppingCart', roles: ['dealer'] },
  { group: 'Dealer portal', href: '/portal/orders', label: 'My orders', icon: 'ClipboardList', roles: ['dealer'] },
  { group: 'Dealer portal', href: '/portal/account', label: 'Invoices & balance', icon: 'Wallet', roles: ['dealer'] },
  { group: 'Dealer portal', href: '/notifications', label: 'Notifications', icon: 'Bell', roles: ['dealer'] },
]

export function canSee(role: DfRole, href: string): boolean {
  if (role === 'admin' && !href.startsWith('/portal')) return true
  const it = NAV.filter(n => n.href === href)
  return it.some(n => n.roles.includes(role))
}
export const defaultPath = (role: DfRole) => (role === 'dealer' ? '/app/portal' : role === 'warehouse' ? '/app/dispatch' : '/app')

// ---------------------------------------------------------------- order workflow
export type OrderStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved' | 'picking' | 'packed'
  | 'partially_fulfilled' | 'dispatched' | 'delivered' | 'rejected' | 'cancelled' | 'returned'

export const ORDER_STATUSES: OrderStatus[] = ['draft', 'submitted', 'under_review', 'approved', 'picking', 'packed', 'partially_fulfilled', 'dispatched', 'delivered', 'rejected', 'cancelled', 'returned']

/** Allowed manual moves. Dispatching (-> partially_fulfilled / dispatched) happens through the dispatch action. */
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'approved', 'rejected', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['cancelled'],
  partially_fulfilled: ['picking', 'delivered'],
  dispatched: ['delivered', 'returned'],
  delivered: ['returned'],
  rejected: [],
  cancelled: [],
  returned: [],
}
/** Who may perform the move. admin is always allowed. */
export const ORDER_MOVE_ROLES: Partial<Record<OrderStatus, DfRole[]>> = {
  submitted: ['sales_manager', 'sales_rep', 'dealer'],
  under_review: ['sales_manager'],
  approved: ['sales_manager'],
  rejected: ['sales_manager'],
  picking: ['warehouse', 'sales_manager'],
  packed: ['warehouse', 'sales_manager'],
  delivered: ['warehouse', 'sales_manager'],
  returned: ['warehouse', 'sales_manager', 'finance'],
  cancelled: ['sales_manager', 'sales_rep', 'dealer'],
}

export const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', submitted: 'bg-blue-100 text-blue-800', under_review: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-cyan-100 text-cyan-800', picking: 'bg-amber-100 text-amber-800', packed: 'bg-amber-100 text-amber-800',
  partially_fulfilled: 'bg-orange-100 text-orange-800', dispatched: 'bg-sky-100 text-sky-800', delivered: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700', cancelled: 'bg-gray-200 text-gray-600', returned: 'bg-rose-100 text-rose-800',
  open: 'bg-blue-100 text-blue-800', partial: 'bg-amber-100 text-amber-800', paid: 'bg-emerald-100 text-emerald-800', void: 'bg-gray-200 text-gray-600',
  active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-gray-200 text-gray-600', blocked: 'bg-red-100 text-red-700',
  trial: 'bg-amber-100 text-amber-800', suspended: 'bg-red-100 text-red-700',
  exception: 'bg-red-100 text-red-700', overdue: 'bg-red-100 text-red-700', low: 'bg-amber-100 text-amber-800', out: 'bg-red-100 text-red-700', ok: 'bg-emerald-100 text-emerald-800',
  new: 'bg-blue-100 text-blue-800', contacted: 'bg-amber-100 text-amber-800', closed: 'bg-gray-200 text-gray-600', replied: 'bg-emerald-100 text-emerald-800',
  connected: 'bg-emerald-100 text-emerald-800', not_set: 'bg-gray-100 text-gray-600',
}

export const labelize = (s: string | null | undefined) =>
  (s || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

export const PAY_MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']
export const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'carton', 'bag', 'm', 'ft', 'set', 'pair', 'dozen', 'ton']
