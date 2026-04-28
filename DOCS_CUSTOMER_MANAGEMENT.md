# CUSTOMER MANAGEMENT — FULL SYSTEM DOCUMENTATION

> **Status**: CURRENT SYSTEM (TO BE REDESIGNED)  
> **Last Audit Date**: 7 April 2026  
> **Source of Truth**: Every detail below is extracted line-by-line from the actual codebase.

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Navigation & Routing](#2-navigation--routing)
3. [Firebase Backend — All Collections & Schemas](#3-firebase-backend)
4. [Context Providers — Full State & Functions](#4-context-providers)
5. [Utility Functions — FirebaseDataUtils](#5-utility-functions)
6. [Components — UI/UX + Frontend Logic](#6-components)

---

## 1. SYSTEM OVERVIEW

### What It Does
Manages the full customer lifecycle for a car workshop: customer database, quotation creation, invoice billing, payment tracking, car repair status, accounting dashboard, and mechanic commissions.

### Files Involved

| File | Role |
|------|------|
| **Components** | |
| `src/components/CustomerDatabase.jsx` (30KB) | Customer list, search, add customer, past transactions |
| `src/components/CustomerInvoiceCreation.jsx` (72KB) | Invoice creation, editing, list, analysis, payment links |
| `src/components/QuotationCreation.jsx` (47KB) | Quotation create/edit/list/view/PDF |
| `src/components/CarStatus.jsx` (14KB) | Repair order tracking dashboard |
| `src/components/AccountingDashboard.jsx` (19KB) | Financial overview, payment recording |
| `src/components/MechanicCommissionDashboard.jsx` (26KB) | Mechanic commission tracking |
| `src/components/InvoiceGeneration.jsx` (11KB) | Parts sales invoice creator |
| `src/components/InvoiceHistory.jsx` (12KB) | Parts sales invoice history |
| `src/components/InvoicePreview.jsx` (30KB) | Print-ready invoice/receipt display |
| `src/components/EditInvoiceModal.jsx` (22KB) | Advanced invoice editor with stock reconciliation |
| `src/components/SimpleEditInvoiceModal.jsx` (12KB) | Lightweight invoice editor |
| `src/components/PaymentReceipt.jsx` (24KB) | Payment callback handler + receipt display |
| **Contexts** | |
| `src/context/CustomerContext.jsx` | Customer state (useReducer) |
| `src/context/InvoiceContext.jsx` | Parts invoice state + edit sessions |
| `src/context/TransactionContext.jsx` | Payment & transaction state (useReducer) |
| `src/context/RepairOrderContext.jsx` | Repair order state (useReducer) |
| `src/context/DataJoinContext.jsx` | Cross-collection data joining (useReducer) |
| **Hooks** | |
| `src/hooks/useInvoiceEditor.js` | Invoice editing hook with conflict resolution |
| **Utils** | |
| `src/utils/FirebaseDataUtils.js` | CRUD functions for customers, invoices, quotations |
| `src/utils/AtomicOperations.js` | Atomic invoice edit + stock restoration |
| `src/utils/StockReconciliation.js` | Stock impact analysis for invoice edits |
| `src/utils/InvoiceEditValidator.js` | Real-time validation during edits |
| `src/utils/LeanxService.js` | Payment link generation (Leanx API) |
| `src/utils/PDFGenerator.js` | PDF generation for invoices/quotations |
| `src/utils/ConflictResolver.js` | Concurrent edit conflict detection |
| `src/utils/AuditTrail.js` | Activity logging |

### Sidebar Navigation (from Sidebar.jsx)

Under **"Customer"** group:
- **Customer Database** → section id: `customers`
- **Car Status** → section id: `car-status`
- **Quotations** → section id: `quotation`
- **Billing & Invoices** → section id: `customer-invoicing`
- **Accounting** → section id: `accounting`
- **Mechanic Commissions** → section id: `mechanic-commissions`

---

## 2. NAVIGATION & ROUTING

No React Router. `activeSection` state string in App.jsx. Components rendered conditionally:

| Section ID | Component |
|------------|-----------|
| `customers` | `<CustomerDatabase setActiveSection={...} />` |
| `car-status` | `<CarStatus />` |
| `quotation` | `<QuotationCreation setActiveSection={...} />` |
| `customer-invoicing` | `<CustomerInvoiceCreation setActiveSection={...} />` |
| `accounting` | `<AccountingDashboard />` |
| `mechanic-commissions` | `<MechanicCommissionDashboard />` |
| `invoice` | `<InvoiceGeneration />` |
| `history` | `<InvoiceHistory />` |

---

## 3. FIREBASE BACKEND

### 3.1 Collection: `customers`

**Type**: External (shared with other systems)  
**Access**: Read/Write

```
{
  id: string                     // Firestore doc ID
  name: string
  phone: string
  email: string
  address: string
  bykiAccountCreated: boolean    // Legacy flag (no longer filtered on)
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Operations:**
- CREATE: `createCustomer()` in FirebaseDataUtils — writes name, phone, email, address, timestamps
- READ: `CustomerContext.loadCustomers()` → `getDocs(collection(db, 'customers'))`, no filter
- SEARCH: Client-side filter on name/phone/email

---

### 3.2 Collection: `customer_invoices`

**Type**: Internal (Read/Write)  
**This is the main billing collection.**

```
{
  id: string                             // Firestore doc ID
  invoiceNumber: string                  // Format: "INV-{timestamp}" (from createCustomerInvoice)
  dateCreated: Timestamp                 // Set on creation OR reset on edit (FirebaseDataUtils)
  dueDate: Timestamp                     // dateCreated + (paymentTerms * 86400000ms)
  updatedAt: Timestamp

  // CUSTOMER
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  customerIC: string                     // IC/ID number
  customerAddress: string

  // VEHICLE
  vehicleInfo: {
    make: string,
    model: string,
    year: string,
    plate: string
  }
  workDescription: string

  // LINE ITEMS
  partsOrdered: [
    { sku: string, partName: string, quantity: number, pricePerUnit: number, total: number }
  ]
  laborCharges: [
    { description: string, amount: number }
  ]

  // FINANCIALS
  partsTotal: number
  laborTotal: number
  subtotal: number
  discount: number                       // The raw input value
  discountType: 'percentage' | 'fixed'
  discountAmount: number                 // Calculated amount
  total: number                          // subtotal - discountAmount
  customerTotal: number                  // Same as total (duplicate field)
  
  // DEPOSIT & PAYMENT
  deposit: number                        // Amount paid so far
  depositStatus: 'none' | 'paid_offline' | 'link_generated' | 'paid_link'
  balanceDue: number                     // total - deposit
  paymentStatus: 'pending' | 'deposit-paid' | 'paid'
  paymentTerms: number                   // Days until due
  paymentMethod: string                  // 'cash' | 'transfer' | 'card' | 'cheque' | 'online_link'
  paymentHistory: [
    { amount: number, date: Timestamp, method: string, recordedBy: string }
  ]
  lastPaymentDate: Timestamp
  lastPaymentLink: string                // Generated payment URL
  lastPaymentId: string                  // Leanx Bill ID
  lastPaymentTransactionId: string

  // DIRECT LENDING
  useDirectLending: boolean
  directLendingAmount: number
  customerPayableAmount: number          // balanceDue - directLendingAmount

  // MECHANICS & COMMISSION
  mechanics: [
    {
      id: string,
      name: string,
      commissionType: 'percentage' | 'fixed',
      commissionValue: number,
      commissionAmount: number           // Calculated
    }
  ]
  commissionAmount: number               // Total commission

  // INTERNAL COSTING
  partsSupplierCost: number              // Cost to business

  // LINKING (Return Jobs)
  parentInvoiceId: string | null
  parentInvoiceNumber: string | null
  invoiceType: 'standard' | 'return_job'

  // MISC
  notes: string
  status: string                         // Not consistently used
}
```

**Operations:**
- CREATE: `createCustomerInvoice(data)` — generates `INV-{timestamp}` number, adds dateCreated
- READ: `onSnapshot(query(collection(db, 'customer_invoices'), orderBy('dateCreated', 'desc')))` — real-time in CustomerInvoiceCreation
- UPDATE: `updateCustomerInvoice(id, data)` — NOTE: resets `dateCreated` to current date on every edit
- DELETE: `deleteDoc(doc(db, 'customer_invoices', id))` — direct, no stock restoration in this path

---

### 3.3 Collection: `quotations`

**Type**: Internal (Read/Write)

```
{
  id: string
  quotationNumber: string                // "QUO-{timestamp}"
  dateCreated: Timestamp
  validUntil: Timestamp                  // dateCreated + validityDays
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  statusUpdatedAt: Timestamp
  updatedAt: Timestamp

  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string

  vehicleInfo: { make, model, year, plate }
  workDescription: string

  partsOrdered: [
    { sku, partName, quantity, pricePerUnit, total }
  ]
  laborCharges: [
    { sku, description, amount }
  ]

  partsTotal: number
  laborTotal: number
  subtotal: number
  discount: number                       // Percentage only
  discountAmount: number
  total: number
  
  notes: string
  terms: string                          // e.g. "Quote valid for 30 days..."
}
```

**Operations:**
- CREATE: `createQuotation(data)` → `QUO-{timestamp}` number
- READ: `onSnapshot(query(quotations, orderBy('dateCreated', 'desc')))` — real-time
- UPDATE: `updateQuotation(id, data)` — adds updatedAt
- STATUS: `updateQuotationStatus(id, status)` — sets status + statusUpdatedAt

---

### 3.4 Collection: `repair_orders`

**Type**: External (Read-Only — updated by mechanics from external system)

```
{
  id: string
  dateCreated: Timestamp
  lastUpdated: Timestamp
  
  customerName: string
  customerEmail: string
  customerPhone: string
  
  vehicleInfo: {
    make: string,
    model: string,
    licensePlate: string,
    mileage: string
  }
  
  repairStatus: 'not_started' | 'under_inspection' | 'inspection_completed' | 'repair_ongoing' | 'ready_for_pickup'
  description: string
  estimatedCost: number
  actualCost: number
  notes: string
}
```

**Operations:**
- READ: Real-time `onSnapshot(query(repair_orders, orderBy('dateCreated', 'desc')))` in RepairOrderContext
- No CREATE/UPDATE/DELETE from this system

---

### 3.5 Collection: `transactions`

**Type**: Internal (Read/Write)

```
{
  id: string
  invoiceId: string
  invoiceNumber: string
  customerName: string
  customerId: string

  transactionNumber: string              // "TXN-{timestamp}"
  amount: number
  date: Timestamp
  paymentDate: Timestamp
  paymentMethod: 'cash' | 'transfer' | 'card' | 'cheque'
  referenceNumber: string
  
  type: 'income' | 'expense'
  category: 'Invoice Payment' | ...
  method: string                         // Duplicate of paymentMethod in some paths
  status: 'completed' | 'pending' | 'failed'
  processedBy: string
  notes: string
  dateCreated: Timestamp
}
```

**Operations:**
- CREATE: `addDoc(collection(db, 'transactions'), data)` — called from AccountingDashboard and TransactionContext
- READ: `getDocs(query(transactions, orderBy('paymentDate', 'desc')))` in TransactionContext

---

### 3.6 Collection: `spare_parts_orders` (External, Read-Only)

Used by DataJoinContext and CustomerContext for customer order history.

```
{
  id: string
  customer_id: string                    // FK to customers
  mechanic_id: string                    // FK to mechanics
  order_date: string/Timestamp
  total_amount: number
  orderItems: [
    { namaProduk, kodProduk, unitPrice, totalPrice, quantity, specification, partId, inventoryStatus, availableQuantity, isCustom, supplierNotes, estimatedDelivery }
  ]
  jobSheetId: string
  jobSheetNumber: string
  orderStatus: string
  totalValue: number
  notes: string
  createdAt: Timestamp
  processedAt: Timestamp
  processedBy: string
  processedByRole: string
  updatedAt: Timestamp
}
```

---

### 3.7 Collection: `mechanics` (External, Read-Only)

```
{ id, name, email, phone, specialty }
```

---

### 3.8 Collection: `byki_status` (External, Read-Only)

Used by CarStatus.jsx — loaded via `onSnapshot(query(byki_status, orderBy('createdAt', 'desc')))`. Schema not defined in code.

---

### 3.9 Collection: `invoices` (Internal Parts Sales)

Separate from `customer_invoices`. Used by InvoiceGeneration/InvoiceHistory for parts-only sales. Documented in Spare Parts doc.

---

## 4. CONTEXT PROVIDERS

### 4.1 CustomerContext (`src/context/CustomerContext.jsx`)

**Pattern**: `useReducer`

**State:**
```
customers: []                    // All from 'customers' collection
selectedCustomer: null           // Currently selected customer object
customerOrders: []               // Orders of selected customer (from spare_parts_orders)
joinedCustomerData: null         
isLoadingCustomers: false
isLoadingOrders: false
customerError: null
searchTerm: ''
filteredCustomers: []
```

**Exposed via `useCustomer()` hook:**

| Function | What It Does |
|----------|-------------|
| `loadCustomers()` | Fetches all docs from `customers` collection. No filter. |
| `selectCustomer(data)` | Accepts customer object or ID string. Sets selectedCustomer. Queries `spare_parts_orders` where `customer_id == customerId`, ordered by `order_date desc`. |
| `searchCustomers(term)` | Filters in-memory by name/phone/email (case-insensitive). |
| `filterActiveCustomers()` | Filters where `bykiAccountCreated === true`. |
| `clearCustomerSelection()` | Resets selectedCustomer, customerOrders, joinedCustomerData. |

**Auto-loads**: `loadCustomers()` on mount. Re-filters when customers array changes.

---

### 4.2 TransactionContext (`src/context/TransactionContext.jsx`)

**Pattern**: `useReducer`

**State:**
```
transactions: []                 // From 'transactions' collection
customerInvoices: []             // From 'customer_invoices' collection
pendingInvoices: []              // Where paymentStatus !== 'paid'
paidInvoices: []                 // Where paymentStatus === 'paid'
accountingSummary: {
  totalRevenue: 0,
  totalPendingAmount: 0,
  totalCommissions: 0,
  totalProfit: 0,
  invoiceCount: 0,
  paidInvoiceCount: 0,
  pendingInvoiceCount: 0,
  averageInvoiceValue: 0
}
isLoadingTransactions: false
isLoadingInvoices: false
transactionError: null
```

**Exposed via `useTransaction()` hook:**

| Function | What It Does |
|----------|-------------|
| `loadTransactions()` | Fetches from `transactions`, ordered by `paymentDate desc` |
| `loadCustomerInvoices()` | Fetches from `customer_invoices`, ordered by `dateCreated desc`. Separates into pending/paid. |
| `recordPayment(paymentData)` | 1) Creates transaction doc in `transactions`. 2) Updates invoice doc: paymentStatus='paid', paymentDate, paymentMethod. 3) Updates local state. |
| `updatePaymentStatus(invoiceId, status)` | Updates `customer_invoices` doc paymentStatus. Adds paymentDate if status='paid'. |
| `generateAccountingSummary()` | Calculates totals from paidInvoices and pendingInvoices. |

**Auto-loads**: Both `loadTransactions()` and `loadCustomerInvoices()` on mount. Summary auto-recalculates when invoice arrays change.

---

### 4.3 RepairOrderContext (`src/context/RepairOrderContext.jsx`)

**Pattern**: `useReducer`

**State:**
```
repairOrders: []
isLoadingOrders: false
orderError: null
statusCounts: {
  not_started: 0,
  under_inspection: 0,
  inspection_completed: 0,
  repair_ongoing: 0,
  ready_for_pickup: 0
}
```

**Exports:**
- `REPAIR_STATUSES` — enum object with 5 status constants
- `STATUS_LABELS` — human-readable labels per status
- `STATUS_COLORS` — Tailwind classes per status

**Exposed via `useRepairOrder()` hook:**

| Function | What It Does |
|----------|-------------|
| `loadRepairOrders()` | One-time fetch from `repair_orders`, ordered by `dateCreated desc` |
| `getOrdersByStatus(status)` | Filters repairOrders by repairStatus |
| `formatDate(date)` | `new Date(date).toLocaleDateString()` |

**Initialization**: Sets up real-time `onSnapshot` listener on mount. Auto-recalculates statusCounts on every update. Cleans up listener on unmount.

---

### 4.4 DataJoinContext (`src/context/DataJoinContext.jsx`)

**Pattern**: `useReducer`

**Purpose**: Joins data across `customers`, `spare_parts_orders`, and `mechanics` collections.

**State:**
```
joinedCustomerData: []           // Customers enriched with order/mechanic data
joinedOrderData: []              // Orders enriched with customer/mechanic data
customerOrderHistory: {}         // Cache: { [customerId]: orderArray }
customerMechanicHistory: {}      // Cache: { [customerId]: mechanicArray }
isLoadingJoinedData: false
joinDataError: null
lastRefreshTime: null
```

**Exposed via `useDataJoin()` hook:**

| Function | What It Does |
|----------|-------------|
| `loadJoinedCustomerData()` | Fetches all customers + spare_parts_orders + mechanics. Groups orders by customer_id. For each customer, computes: totalOrders, totalSpent, lastOrderDate, mechanicsWorked, primaryMechanic, isActiveCustomer (order within 90 days), averageOrderValue. |
| `loadJoinedOrderData()` | Fetches all orders + customers + mechanics. Joins on customer_id and mechanic_id. Adds customerName, customerPhone, mechanicName, mechanicEmail. |
| `getCustomerOrderHistory(customerId)` | Queries `spare_parts_orders` where `customer_id == customerId`. Caches result. |
| `getCustomerMechanicHistory(customerId)` | Gets unique mechanics from customer's orders. Caches result. |
| `searchJoinedData(searchTerm)` | Searches across customer fields (name/phone/email/address), order fields (order_number/notes), mechanic fields (name/email). |
| `refreshJoinedData()` | Runs both load operations in parallel. |

**Auto-loads**: Both `loadJoinedCustomerData()` and `loadJoinedOrderData()` on mount.

---

### 4.5 InvoiceContext (for parts `invoices` collection)

Documented in Spare Parts doc. Key: This is a SEPARATE system from `customer_invoices`.

---

## 5. UTILITY FUNCTIONS

### 5.1 FirebaseDataUtils.js

**Customer CRUD:**
| Function | Collection | Operation |
|----------|-----------|-----------|
| `createCustomer(data)` | `customers` | addDoc with name, phone, email, address, timestamps |
| `getAllCustomers()` | `customers` | getDocs, returns array |
| `getCustomerById(id)` | `customers` | getDoc by ID |
| `searchCustomers(term)` | `customers` | Gets all then client-side filters |
| `getCustomerOrders(customerId)` | `spare_parts_orders` | Queries by `customerId` field (note: different from `customer_id` used elsewhere). Flattens orderItems into individual parts. Deduplicates by `kodProduk + unitPrice + specification`. Sorts newest first. |

**Invoice CRUD:**
| Function | Collection | Operation |
|----------|-----------|-----------|
| `createCustomerInvoice(data)` | `customer_invoices` | Generates `INV-{Date.now()}` number. Adds dateCreated + paymentStatus. |
| `getAllCustomerInvoices()` | `customer_invoices` | getDocs ordered by dateCreated desc |
| `updateCustomerInvoice(id, data)` | `customer_invoices` | **WARNING**: Resets `dateCreated` to NOW on every update |
| `updateCustomerInvoicePayment(id, data)` | `customer_invoices` | Updates paymentStatus, paymentDate, paymentMethod |

**Quotation CRUD:**
| Function | Collection | Operation |
|----------|-----------|-----------|
| `createQuotation(data)` | `quotations` | Generates `QUO-{Date.now()}` number |
| `getAllQuotations()` | `quotations` | getDocs ordered by dateCreated desc |
| `updateQuotation(id, data)` | `quotations` | Adds updatedAt |
| `updateQuotationStatus(id, status)` | `quotations` | Sets status + statusUpdatedAt |

---

## 6. COMPONENTS

---

### 6.1 CustomerDatabase.jsx

**Props**: `{ setActiveSection }` — to navigate to invoice creation

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `searchTerm` | string | '' |
| `selectedCustomer` | object\|null | null |
| `showCustomerModal` | boolean | false |
| `pastCustomers` | array | [] |
| `isLoadingPastCustomers` | boolean | true |
| `selectedPastCustomer` | object\|null | null |
| `showPastCustomerModal` | boolean | false |
| `activeTab` | string | 'active' |
| `showAddCustomerModal` | boolean | false |
| `newCustomer` | object | `{ name: '', phone: '', email: '', address: '' }` |
| `isSaving` | boolean | false |

**Data Sources**: `useCustomer()` for customers, `useDataJoin()` for joinedCustomerData + searchJoinedData

**Past Customers Fetch (`fetchPastCustomers`):**
1. Queries `customer_invoices` ordered by dateCreated desc
2. First tries `where('paymentStatus', '==', 'paid')`
3. If no results, falls back to ALL invoices
4. Groups by customerId into Map
5. Calculates per-customer: name, phone, email, totalSpent, invoiceCount, lastInvoiceDate
6. Sorts by lastInvoiceDate desc

**UI Layout:**

1. **Stats Row** (3 cards):
   - **Total Customers**: `joinedCustomerData.length`
   - **Active (Recent)**: Past customers with lastInvoiceDate within 30 days
   - **Avg. Spend**: Total spent / number of past customers

2. **Tab Bar**: "Active Customers" | "Past Transactions"
3. **Search Bar** + **Add Customer** button

4. **Active Customers Tab** (table):
   - Columns: Customer Name (with address preview) | Phone | Email | Actions
   - Row click → opens customer details modal
   - "Create Invoice" button → calls `handleCreateInvoice(customer)` which selects customer and navigates to `customer-invoicing`

5. **Past Transactions Tab** (table):
   - Columns: Customer Name (with phone) | Total Spent | Visits | Last Visit | Actions
   - Row click → opens past customer modal with invoice history
   - "View History" link

6. **Add Customer Modal**:
   - Fields: Full Name* | Phone Number* | Email | Address (textarea)
   - Validation: name and phone required
   - Saves via `createCustomer(newCustomer)` from FirebaseDataUtils
   - Cancel + Save buttons

---

### 6.2 CustomerInvoiceCreation.jsx (72KB — largest component)

**Props**: `{ setActiveSection }`

**Three View Modes**: `viewMode` = `'list'` | `'form'` | `'analysis'`

**State Variables (complete list):**

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `viewMode` | string | 'list' | Current view |
| `isEditing` | boolean | false | Edit mode flag |
| `editingId` | string\|null | null | ID of invoice being edited |
| `selectedCustomer` | object\|null | null | Selected customer for form |
| `showCustomerModal` | boolean | false | Customer picker modal |
| `viewInvoice` | object\|null | null | Invoice being viewed |
| `showPDF` | boolean | false | PDF preview flag |
| `showReceipt` | object\|null | null | Receipt view invoice |
| `customerSearchTerm` | string | '' | Customer search in modal |
| `paymentLinkModal` | object | `{ show, url, invoice, loading, error }` | Payment link state |
| `analysisSearch` | string | '' | Search in analysis view |
| `manualParts` | array | [] | Parts line items |
| `laborCharges` | array | [] | Labor line items |
| `workDescription` | string | '' | Work description |
| `vehicleInfo` | object | `{ make, model, year, plate }` | Vehicle details |
| `paymentTerms` | number | 30 | Days until due |
| `paymentStatus` | string | 'pending' | Current status |
| `discount` | number | 0 | Discount value |
| `discountType` | string | 'percentage' | 'percentage' or 'fixed' |
| `deposit` | number | 0 | Deposit amount |
| `depositStatus` | string | 'none' | Deposit tracking |
| `notes` | string | '' | Additional notes |
| `parentInvoiceId` | string\|null | null | For return jobs |
| `parentInvoiceNumber` | string\|null | null | For return jobs |
| `useDirectLending` | boolean | false | Direct lending toggle |
| `directLendingAmount` | number | 0 | Lending amount |
| `totalPartsSupplierCost` | number | 0 | Internal cost |
| `mechanics` | array | [] | Commission mechanics array |
| `requestDepositAmount` | number | 0 | Requested deposit via link |
| `invoiceHistory` | array | [] | All invoices (real-time) |
| `searchQuery` | string | '' | List view search |
| `isSaving` | boolean | false | Save in progress |
| `sortField` | string | 'dateCreated' | Sort column |
| `sortDirection` | string | 'desc' | Sort order |
| `statusFilter` | string | 'all' | Payment status filter |

**Real-time Data**: `onSnapshot(query(collection(db, 'customer_invoices'), orderBy('dateCreated', 'desc')))` — stores in `invoiceHistory`

**Payment Callback Handler (useEffect):**
- Reads URL params: `payment_status`, `invoice`, `amount`
- If `status === 'success'` and invoice found in history:
  - Calculates new deposit and balance
  - Updates invoice via `updateCustomerInvoice()`
  - Clears URL params via `window.history.replaceState()`

**`calculateTotals()` — The Core Financial Engine:**
```
Input: All form state (manualParts, laborCharges, discount, discountType, deposit, 
       useDirectLending, directLendingAmount, totalPartsSupplierCost, mechanics)

1. partsTotal = Σ(quantity × pricePerUnit) for each part — rounded to prevent float drift
2. laborTotal = Σ(amount) for each labor charge
3. subtotal = partsTotal + laborTotal (rounded)
4. discountAmount = fixed ? discount : subtotal × discount / 100 (rounded)
5. total = subtotal - discountAmount (rounded)
6. depositAmount = parseFloat(deposit) || 0
7. balanceDue = total - depositAmount (rounded)
8. directLending = useDirectLending ? directLendingAmount : 0
9. customerPayableAmount = balanceDue - directLending

Commission Calculation:
  For each mechanic in mechanics[]:
    if commissionType === 'percentage': amount = subtotal × commissionValue / 100
    if commissionType === 'fixed': amount = commissionValue
    totalCommission += amount

Profit Calculation:
  costOfParts = totalPartsSupplierCost
  netProfit = total - costOfParts - totalCommission

Output: { partsTotal, laborTotal, subtotal, discountAmount, total, deposit, balanceDue,
          directLendingAmount, customerPayableAmount, partsSupplierCost, commission, 
          calculatedMechanics }
```

**`handleSaveInvoice()`:**
1. Validates: customer selected + at least one part/labor
2. Sanitizes data (replaces undefined with null recursively)
3. Constructs full invoiceData object with all financial fields
4. If editing: `updateCustomerInvoice(editingId, data)`
5. If creating: `createCustomerInvoice(data)` — adds dateCreated + dueDate
6. If `requestDepositAmount > 0`: opens payment link modal
7. Resets form + returns to list view

**`handleReturnJob(invoice)`:**
- Resets form, pre-fills customer + vehicle from original invoice
- Sets parentInvoiceId + parentInvoiceNumber for linking
- Sets workDescription to "Return Job / Warranty Claim for Invoice #XXX"
- Switches to form view

**Payment Link System:**
- `handleLink(invoice)`: Analyzes current balance vs existing link. Smart detection:
  - If deposit phase: show existing link
  - If no deposit, unpaid: show existing link
  - If deposit paid, balance remains: force new link
  - Fallback: show existing
- `generateLink()`: Calls `LeanxService.generatePaymentLink()`. On failure: generates demo URL fallback. Saves link to invoice doc.
- `confirmDepositPaid(invoice)`: Manual admin verification for deposit payment

**Analysis View:**
- Calculates per-invoice: revenue, cost (supplier + commission), profit
- Totals: rev, cost, profit, margin percentage

**LIST VIEW UI:**
- 4 stat cards: Total Invoices | Total Revenue (green) | Total Profit (blue + margin %) | New Invoice button
- Detailed Analysis button → analysis view
- Invoice table with sortable columns (date, amount, customer, balance)
- Status filter buttons: All | Unpaid | Deposit Paid | Full Payment
- Row actions: View | Edit | Link (payment) | Receipt | Return Job | Delete

**FORM VIEW UI:**
- Customer selection section (blue highlight) + Change button
- Vehicle info: Make/Model | Plate Number | Work Description
- Discount: Toggle % or Fixed RM + amount input
- Parts table: SKU | Name | Qty | Price | Total | Delete
- Labor table: Description | Amount | Delete
- Payment section (blue panel): Deposit Paid (Offline) + Request Deposit (Payment Link)
- Internal costing (yellow panel): Supplier Part Costs + Mechanic Commission section
  - Mechanic dropdown to add mechanics from employees
  - Per-mechanic cards: Name | Type (% or RM) | Value | Calculated Amount | Delete
  - Total Commission summary
  - Estimated Net Profit (green)
- Totals display: Subtotal | Discount | Final Invoice Total (large bold)
- Save Invoice button

---

### 6.3 QuotationCreation.jsx

**Props**: `{ setActiveSection }`

**Two View Modes**: `'list'` | `'form'`

**State Variables:**
| Variable | Type | Default |
|----------|------|---------|
| `viewMode` | string | 'list' |
| `isEditing` | boolean | false |
| `editingId` | string\|null | null |
| `selectedCustomer` | object\|null | null |
| `showCustomerModal` | boolean | false |
| `customerSearchTerm` | string | '' |
| `showViewQuotationModal` | boolean | false |
| `selectedQuotationForView` | object\|null | null |
| `manualParts` | array | [] |
| `laborCharges` | array | [] |
| `workDescription` | string | '' |
| `vehicleInfo` | object | `{ make, model, year, plate }` |
| `validityDays` | number | 30 |
| `discount` | number | 0 |
| `notes` | string | '' |
| `terms` | string | 'Quote valid for 30 days. Prices subject to change.' |
| `quotationHistory` | array | [] |
| `searchQuery` | string | '' |
| `statusFilter` | string | 'all' |
| `isSaving` | boolean | false |

**Real-time**: `onSnapshot(query(quotations, orderBy('dateCreated', 'desc')))` → quotationHistory

**`calculateTotals()` (simpler than invoice):**
```
partsTotal = Σ(part.total) — pre-calculated per-part total
laborTotal = Σ(labor.amount)
subtotal = partsTotal + laborTotal
discountAmount = subtotal × discount / 100   (% only, no fixed option)
total = subtotal - discountAmount
```

**Stats**: total quotes, pending count, accepted count, pending value

**LIST VIEW UI:**
- 4 stat cards: Total Quotes | Pending Value (with count) | Accepted count | Create New Quote (blue action card)
- Table: Ref # | Customer (with vehicle) | Amount | Date | Status | Actions
- Status badges: Pending (yellow) | Accepted (green) | Rejected (red) | Expired (gray)
- Actions: View 👁️ | Edit ✏️ | Download PDF 📥
- Search + status filter

**FORM VIEW UI (numbered steps):**
1. Customer Selection (blue card)
2. Vehicle Information: 4 fields (Make | Model | Year | Plate) + Work Description
3. Parts & Labor: "+ Add Part" (blue) | "+ Add Labor" (green) + tables
4. Terms & Summary: Validity Period | Notes | Terms & Conditions + Totals with discount

**View Quotation Modal**: Recipient info | Vehicle | Items table | Totals | Download PDF

---

### 6.4 CarStatus.jsx

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `selectedStatus` | string | 'all' |
| `searchTerm` | string | '' |
| `bykiStatusData` | array | [] |
| `isLoadingBykiStatus` | boolean | true |
| `bykiStatusError` | string\|null | null |

**Data Sources**: `useRepairOrder()` for repairOrders + statusCounts

**Also loads**: `byki_status` collection separately via onSnapshot

**Status Progress**: Maps each status to a progress percentage (20% per step, 5 steps total)

**UI Layout:**
1. **Status Cards** (5-column grid): One per REPAIR_STATUS with count, clickable to filter
2. **Main Table**: Vehicle Details (make/model + plate) | Customer | Status & Progress bar | Last Update | Action arrow
3. Search by vehicle/plate/customer

---

### 6.5 AccountingDashboard.jsx

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `selectedTimeframe` | string | 'month' |
| `showPaymentModal` | boolean | false |
| `selectedInvoice` | object\|null | null |
| `showTransactionModal` | boolean | false |
| `selectedTransaction` | object\|null | null |
| `paymentData` | object | `{ amount: 0, paymentMethod: 'cash', referenceNumber: '', notes: '' }` |
| `customerInvoices` | array | [] |
| `transactions` | array | [] |
| `isLoading` | boolean | true |
| `accountingSearch` | string | '' |

**Real-time**: `onSnapshot(query(customer_invoices, orderBy('dateCreated', 'desc')))` → customerInvoices

**Stats Calculation (`getStats()`):**
- Filters invoices by timeframe (month/year/all)
- `totalRevenue` = Σ(customerTotal OR total)
- `pendingPayment` = Σ(balanceDue) for unpaid invoices
- `collected` = totalRevenue - pendingPayment

**`handlePaymentSubmit()`:**
1. Calculates new paid amount (currentPaid + paymentAmount)
2. Calculates new balance
3. Determines status: paid (balance ≤ 1) | deposit-paid (paid > 0) | pending
4. Updates invoice doc: deposit, balanceDue, paymentStatus, lastPaymentDate, paymentHistory array
5. Creates transaction doc in `transactions` collection

**UI Layout:**
1. **Header**: Title + Search input + Timeframe toggle (This Month | This Year | All Time)
2. **Stats Cards** (4): Total Revenue (blue) | Collected (green with progress bar) | Outstanding (red) | Record Payment (purple action card)
3. **Two-Column Layout**:
   - Left: Unpaid Invoices table (Invoice # | Customer | Balance Due)
   - Right: Recent Activity/Payments table
4. **Payment Recording Modal**: Invoice selector + Amount + Method dropdown (Cash/Transfer/Card/Cheque) + Reference number + Notes

---

### 6.6 MechanicCommissionDashboard.jsx

Details from subagent report — tracks per-mechanic commissions across invoices.

**Features:**
- Timeframe selector (Week/Month/Quarter/Year)
- Mechanic selector (All or individual)
- Summary cards: Total Commissions | Total Revenue | Active Mechanics
- Commission breakdown table per mechanic
- Handles both Commission 2.0 (array) and legacy format (single mechanic)
- Details modal showing individual invoices per mechanic

---

### 6.7 InvoiceGeneration.jsx

Parts-only sales invoice creator. Two-column layout:
- Left: PartsSelector component  
- Right: Cart with customer inputs, qty controls, markup controls, total
- "Complete Sale" creates invoice in `invoices` collection (not `customer_invoices`)

---

### 6.8 InvoiceHistory.jsx

Parts-only invoice archive:
- Stats: Total Invoices | Total Revenue | Average Value
- Search + date range filter
- Table: Invoice # | Date | Customer | Items (code preview) | Amount | Actions (View/Edit/PDF/Delete)
- Uses InvoicePreview modal + EditInvoiceModal

---

### 6.9 InvoicePreview.jsx (30KB)

Print-ready invoice display:
- Header: Logo | Invoice # | Date
- Customer & Vehicle info (2-column)
- Items table with page break support (20 items/page)
- Totals: Subtotal | Discount | Deposit | Total Due
- Footer: Bank details, notes, company info
- Print CSS: A4, 15mm margins, color-accurate

---

### 6.10 PaymentReceipt.jsx

Payment callback handler:
- Parses URL params (payment_status, amount, invoice_number, transaction_id)
- Idempotency check via transaction_id
- States: loading → verifying → success/failed
- Auto-redirect on success
- Receipt display as fallback: customer info, amount, status badge, download PDF
- Handles deposit vs balance payment differentiation

---

### 6.11 EditInvoiceModal.jsx (22KB)

Advanced invoice editor with stock reconciliation:
- Sticky header with "Unsaved Changes" indicator
- Validation status panel (errors/warnings)
- Editable customer info, parts list, notes
- Stock Impact button → StockChangeSummary component
- Add Parts via PartsSelector
- Internal cost management (supplier costs)
- Sticky bottom: Cancel + Save with amount display
- Uses useInvoiceEditor hook for conflict detection + atomic saves

---

### 6.12 SimpleEditInvoiceModal.jsx

Lightweight version of EditInvoiceModal:
- Customer info editing
- Parts list with qty adjustments + delete
- Notes
- Summary totals
- Cancel + Save
