import { FieldDef } from '@/components/df/ResourcePage'

export const DEALER_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Business name', required: true }, { key: 'contact_person', label: 'Contact person' },
  { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' },
  { key: 'gstin', label: 'GSTIN', help: '15 characters, optional' }, { key: 'category', label: 'Dealer category', placeholder: 'e.g. Gold, Retailer' },
  { key: 'billing_address', label: 'Billing address', type: 'textarea' }, { key: 'shipping_address', label: 'Shipping address', type: 'textarea' },
  { key: 'rep_id', label: 'Sales representative', type: 'select', options: { remote: 'staff', label: (s: any) => s.full_name || s.email, filter: (s: any) => ['sales_rep', 'sales_manager', 'admin'].includes(s.role) } },
  { key: 'territory_id', label: 'Territory', type: 'select', options: { remote: 'territories', label: (t: any) => t.name } },
  { key: 'price_list_id', label: 'Price list', type: 'select', options: { remote: 'price_lists', label: (p: any) => p.name } },
  { key: 'credit_limit', label: 'Credit limit (₹)', type: 'number', default: 0, help: '0 = no limit set' },
  { key: 'payment_terms_days', label: 'Payment terms (days)', type: 'number', default: 30 }, { key: 'opening_balance', label: 'Opening balance (₹)', type: 'number', default: 0, help: 'What the dealer already owes you' },
  { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'blocked', label: 'Blocked' }], default: 'active' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

