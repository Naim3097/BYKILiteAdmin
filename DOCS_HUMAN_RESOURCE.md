# HUMAN RESOURCE — FULL SYSTEM DOCUMENTATION

> **Status**: CURRENT SYSTEM (TO BE MADE FULLY OPERATIONAL)  
> **Last Audit Date**: 7 April 2026  
> **Source of Truth**: Every detail below is extracted line-by-line from the actual codebase.

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Navigation & Routing](#2-navigation--routing)
3. [Authentication System](#3-authentication-system)
4. [Firebase Backend — All Collections & Schemas](#4-firebase-backend)
5. [Context Provider — EmployeeContext (Full)](#5-context-provider)
6. [Components — UI/UX + Frontend Logic](#6-components)
7. [Problems & Gaps](#7-problems--gaps)

---

## 1. SYSTEM OVERVIEW

### What It Does
Manages the HR lifecycle for a car workshop: employee database, attendance time clock, leave management with balances, payroll generation, and performance reviews.

### Files Involved

| File | Role | Size |
|------|------|------|
| `src/components/HRDashboard.jsx` | HR overview dashboard | ~300 lines |
| `src/components/EmployeeManagement.jsx` | Employee CRUD + table | ~450 lines |
| `src/components/AttendanceTracking.jsx` | Clock in/out + daily report + leave requests | ~500 lines |
| `src/components/LeaveManagement.jsx` | Leave application/approval + balances + calendar | ~700 lines |
| `src/components/PayrollManagement.jsx` | Payroll generation + history + rates | ~500 lines |
| `src/components/PerformanceReviews.jsx` | Review form + ratings + stats | ~430 lines |
| `src/components/Login.jsx` | Hardcoded password login | ~110 lines |
| `src/components/LoginScreen.jsx` | Firebase Auth email/password login | ~120 lines |
| `src/context/EmployeeContext.jsx` | All HR state + functions | ~340 lines |
| `src/context/AuthContext.jsx` | Firebase Auth wrapper | ~50 lines |

### Sidebar Navigation (from Sidebar.jsx)

Under **"Human Resources"** group (default collapsed):
- **Dashboard** → section id: `hr-dashboard`
- **Employees** → section id: `employee-management`
- **Attendance** → section id: `attendance-tracking`
- **Leaves** → section id: `leave-management`
- **Payroll** → section id: `payroll-management`
- **Reviews** → section id: `performance-reviews`

---

## 2. NAVIGATION & ROUTING

No React Router. `activeSection` state string in App.jsx.

| Section ID | Component |
|------------|-----------|
| `hr-dashboard` | `<HRDashboard />` |
| `employee-management` | `<EmployeeManagement />` |
| `attendance-tracking` | `<AttendanceTracking />` |
| `leave-management` | `<LeaveManagement />` |
| `payroll-management` | `<PayrollManagement />` |
| `performance-reviews` | `<PerformanceReviews />` |

---

## 3. AUTHENTICATION SYSTEM

### Dual Login System

The system has TWO separate login mechanisms:

#### 3.1 Login.jsx — Hardcoded Password

- **Password**: `Onex@1234` (hardcoded constant `SYSTEM_PASSWORD`)
- **Flow**: User enters password → compared against hardcoded string → sets `localStorage.setItem('onex_auth', 'authenticated')` → calls `onLogin(true)`
- **No Firebase Auth involved**
- **No user identity** — just a gate
- **Simulated delay**: 800ms `setTimeout` for "UX"

#### 3.2 LoginScreen.jsx — Firebase Auth

- **Email pre-filled**: `staff@onexhub.com`
- **Uses**: `signInWithEmailAndPassword(auth, email, password)` from Firebase Auth
- **Error handling** for: user-not-found, wrong-password, invalid-email, too-many-requests, network-request-failed, invalid-credential
- **Calls**: `onLoginSuccess()` callback on success

#### 3.3 AuthContext.jsx — Firebase Auth State

- **State**: `user` (Firebase User object or null), `loading` (boolean)
- **Listener**: `onAuthStateChanged(auth, callback)` — real-time auth state tracking
- **Exports**: `user`, `loading`, `logout` (calls `signOut(auth)`), `isAuthenticated` (!!user)
- **NOTE**: AuthContext is NOT connected to EmployeeContext — no role-based access

---

## 4. FIREBASE BACKEND

### 4.1 Collection: `employees`

**Type**: Internal (Read/Write)  
**Listener**: Real-time `onSnapshot(query(employees, orderBy('lastName', 'asc')))` in EmployeeContext

```
{
  id: string                     // Firestore doc ID
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string                   // From EMPLOYEE_ROLES enum
  department: string             // From EMPLOYEE_DEPARTMENTS enum
  hourlyRate: string|number      // Stored as string from form, used as number in payroll
  salary: string|number          // Annual salary — same type issue
  startDate: string              // ISO date string from date input
  address: string
  emergencyContact: string
  emergencyPhone: string
  notes: string
  status: 'active' | 'inactive'  // Set to 'active' on create, 'inactive' on delete
  terminationDate: Timestamp     // Set on soft delete
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**EMPLOYEE_ROLES enum** (7 values):
```
MECHANIC: 'mechanic'
SERVICE_ADVISOR: 'service_advisor'
MANAGER: 'manager'
RECEPTIONIST: 'receptionist'
PARTS_SPECIALIST: 'parts_specialist'
CASHIER: 'cashier'
OWNER: 'owner'
```

**EMPLOYEE_DEPARTMENTS enum** (4 values):
```
SERVICE: 'service'
PARTS: 'parts'
ADMINISTRATION: 'administration'
MANAGEMENT: 'management'
```

---

### 4.2 Collection: `attendance`

**Type**: Internal (Read/Write)  
**Listener**: Real-time `onSnapshot(query(attendance, orderBy('date', 'desc')))` in EmployeeContext

```
{
  id: string                     // Firestore doc ID
  employeeId: string             // FK to employees
  date: string                   // ISO date string (YYYY-MM-DD) from toISOString().split('T')[0]
  clockIn: Timestamp             // Firebase Timestamp
  clockOut: Timestamp | null     // Set on clock out
  status: string                 // From ATTENDANCE_STATUS enum
  createdAt: Timestamp
  updatedAt: Timestamp           // Set on clock out
}
```

**ATTENDANCE_STATUS enum** (5 values):
```
PRESENT: 'present'
ABSENT: 'absent'
LATE: 'late'
ON_LEAVE: 'on_leave'
SICK: 'sick'
```

---

### 4.3 Collection: `leave_requests`

**Type**: Internal (Read/Write)  
**Access**: Direct Firestore queries in LeaveManagement.jsx (NOT via EmployeeContext listener)

```
{
  id: string
  employeeId: string             // FK to employees
  employeeName: string           // Denormalized: "{firstName} {lastName}"
  employeeRole: string           // Denormalized role

  leaveType: string              // Keys from LEAVE_CONFIGURATIONS
  startDate: string              // ISO date string
  endDate: string                // ISO date string
  totalDays: number              // Calculated: endDate - startDate + 1 (or 0.5 for half day)
  isHalfDay: boolean

  reason: string
  notes: string
  emergencyContact: string
  workCoverage: string           // Who covers the work

  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  appliedBy: string              // Hardcoded 'admin'
  appliedDate: string            // ISO date string
  reviewedDate: string           // ISO date string (set on approve/reject)
  reviewedBy: string             // Hardcoded 'admin'
  adminNotes: string             // Notes from reviewer

  createdAt: Date                // JavaScript Date (NOT Timestamp — inconsistency)
}
```

**LEAVE_TYPES enum** (6 values — defined in EmployeeContext):
```
VACATION: 'vacation'
SICK: 'sick'
PERSONAL: 'personal'
EMERGENCY: 'emergency'
MATERNITY: 'maternity'
PATERNITY: 'paternity'
```

**LEAVE_CONFIGURATIONS** (defined locally in LeaveManagement.jsx — NOT in context):
```
annual:     { label: 'Annual Leave',     annualAllocation: 15, carryOver: true,  requiresApproval: true  }
sick:       { label: 'Medical Leave',    annualAllocation: 15, carryOver: false, requiresApproval: false }
unpaid:     { label: 'Unpaid Leave',     annualAllocation: 15, carryOver: false, requiresApproval: true  }
emergency:  { label: 'Emergency Leave',  annualAllocation: 5,  carryOver: false, requiresApproval: true  }
maternity:  { label: 'Maternity Leave',  annualAllocation: 90, carryOver: false, requiresApproval: true  }
paternity:  { label: 'Paternity Leave',  annualAllocation: 14, carryOver: false, requiresApproval: true  }
```

**NOTE**: The LEAVE_TYPES in EmployeeContext (vacation/sick/personal/emergency/maternity/paternity) DO NOT match the LEAVE_CONFIGURATIONS keys in LeaveManagement (annual/sick/unpaid/emergency/maternity/paternity). `vacation` ≠ `annual`, `personal` ≠ `unpaid`.

---

### 4.4 Collection: `payroll`

**Type**: Internal (Read-Only in current code)  
**Listener**: Real-time `onSnapshot(query(payroll, orderBy('payPeriodEnd', 'desc')))` in EmployeeContext

**Schema**: No payroll records are ever CREATED from the UI. The `calculatePayroll()` function returns data in-memory but does NOT save to Firestore. The listener exists but the collection is likely empty.

Expected schema from `calculatePayroll()` output:
```
{
  employeeId: string
  payPeriodStart: string
  payPeriodEnd: string
  totalHours: number
  overtimeHours: number
  basePay: number
  overtimePay: number
  commission: number             // Currently always 0 (placeholder)
  grossPay: number               // basePay + overtimePay + commission
  netPay: number                 // grossPay × 0.8 (simplified 20% tax)
}
```

---

### 4.5 Collection: `performance_reviews`

**Type**: Internal (Read/Write)  
**Access**: `addDoc(collection(db, 'performance_reviews'), data)` via EmployeeContext  
**NOTE**: No real-time listener set up in EmployeeContext. The `performanceReviews` state is initialized as `[]` and never populated via `onSnapshot`. Reviews written to Firestore but never read back.

```
{
  id: string
  employeeId: string             // FK to employees
  reviewDate: string             // ISO date string (YYYY-MM-DD)
  reviewPeriod: 'quarterly' | 'semi-annual' | 'annual' | 'probationary'

  // Ratings (1-5 scale, stored as integers)
  overallRating: number
  jobKnowledge: number
  qualityOfWork: number
  productivity: number
  communication: number
  teamwork: number
  punctuality: number

  // Text fields
  goals: string                  // Goals for next period
  improvements: string           // Areas for improvement
  comments: string               // Additional comments

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## 5. CONTEXT PROVIDER — EmployeeContext

**Pattern**: `useState` (NOT useReducer like other contexts)

### State Variables:

| Variable | Type | Default | Real-time? |
|----------|------|---------|-----------|
| `employees` | array | `[]` | YES — onSnapshot on `employees` |
| `employeeLoading` | boolean | `true` | — |
| `selectedEmployee` | object\|null | `null` | — |
| `attendanceRecords` | array | `[]` | YES — onSnapshot on `attendance` |
| `schedules` | array | `[]` | NO — never populated |
| `leaveRequests` | array | `[]` | NO — never populated (LeaveManagement fetches directly) |
| `payrollRecords` | array | `[]` | YES — onSnapshot on `payroll` (but collection likely empty) |
| `commissionRates` | object | `{}` | NO — never populated |
| `performanceReviews` | array | `[]` | NO — never populated |

### Real-time Listeners (set up on mount):

1. **employees**: `onSnapshot(query(employees, orderBy('lastName', 'asc')))` → `setEmployees(data)` + `setEmployeeLoading(false)`
2. **attendance**: `onSnapshot(query(attendance, orderBy('date', 'desc')))` → `setAttendanceRecords(data)`
3. **payroll**: `onSnapshot(query(payroll, orderBy('payPeriodEnd', 'desc')))` → `setPayrollRecords(data)`

Cleanup: All 3 unsubscribe functions called on unmount.

### Exposed Functions:

| Function | Signature | What It Does |
|----------|-----------|-------------|
| `addEmployee(data)` | `async (employeeData) → docId` | Writes to `employees` collection. Adds `createdAt`, `updatedAt` (Timestamps), `status: 'active'`. Returns doc ID. |
| `updateEmployee(id, updates)` | `async (employeeId, updates) → void` | Updates doc in `employees`. Adds `updatedAt` Timestamp. |
| `deleteEmployee(id)` | `async (employeeId) → void` | **SOFT DELETE**: Sets `status: 'inactive'`, `terminationDate: Timestamp.now()`, `updatedAt`. Does NOT remove doc. |
| `clockIn(employeeId)` | `async (employeeId) → void` | Creates doc in `attendance`: `{ employeeId, date: today (YYYY-MM-DD), clockIn: Timestamp.now(), status: 'present', createdAt }`. |
| `clockOut(employeeId, attendanceId)` | `async (employeeId, attendanceId) → void` | Updates the attendance doc: `{ clockOut: Timestamp.now(), updatedAt }`. |
| `submitLeaveRequest(data)` | `async (leaveData) → void` | Creates doc in `leave_requests`: `{ ...leaveData, status: 'pending', submittedAt, createdAt }`. |
| `calculatePayroll(empId, start, end)` | `(employeeId, payPeriodStart, payPeriodEnd) → object|null` | **PURE FUNCTION** (no Firestore write). Finds employee, filters attendance records by period, calculates hours from clockIn/clockOut diff, computes basePay (hourlyRate × hours OR salary ÷ 26), overtime (>40 hrs at 1.5×), commission (always 0 placeholder), grossPay, netPay (80% of gross — simplified tax). |
| `addPerformanceReview(data)` | `async (reviewData) → void` | Creates doc in `performance_reviews`: `{ ...reviewData, createdAt, updatedAt }`. |
| `getActiveEmployees()` | `() → array` | Filters employees where `status === 'active'`. |
| `getEmployeesByDepartment(dept)` | `(department) → array` | Filters employees where `department === dept && status === 'active'`. |
| `getTodaysAttendance()` | `() → array` | Filters attendanceRecords where `date === today (YYYY-MM-DD)`. |

### Exported Constants:
- `EMPLOYEE_ROLES` (7 values)
- `EMPLOYEE_DEPARTMENTS` (4 values)
- `ATTENDANCE_STATUS` (5 values)
- `LEAVE_TYPES` (6 values)

---

## 6. COMPONENTS

---

### 6.1 HRDashboard.jsx

**Props**: None

**Data from Context**: `employees`, `employeeLoading`, `getActiveEmployees()`, `getEmployeesByDepartment()`, `getTodaysAttendance()`, `attendanceRecords`, `EMPLOYEE_DEPARTMENTS`, `ATTENDANCE_STATUS`

**Computed Values**:
- `activeEmployees` = `getActiveEmployees()`
- `todaysAttendance` = `getTodaysAttendance()`
- `totalEmployees` = `activeEmployees.length`
- `presentToday` = count where status === PRESENT
- `absentToday` = count where status === ABSENT
- `lateToday` = count where status === LATE
- `departmentStats` = for each DEPARTMENT, count of active employees
- `recentAttendance` = attendance records within last 7 days

**UI Layout:**

1. **Header Card**: Title "Human Resources Dashboard" + Today's date (full format: weekday, month day, year)

2. **Stats Row** (4 cards):
   - Total Employees (blue icon)
   - Present Today (green icon + green number)
   - Absent Today (red icon + red number)
   - Late Today (yellow icon + yellow number)

3. **Two-Column Grid:**
   - **Left: "Employees by Department"**: List with blue dots, department name (capitalized), count + "employees" label
   - **Right: "Quick Actions"**: 4 buttons (non-functional — no onClick handlers):
     - Add New Employee (blue icon)
     - View Time Clock (green icon)
     - Generate Payroll (purple icon)
     - Performance Reviews (orange icon)
     - **NOTE**: These buttons have NO onClick — they are purely visual

4. **Two-Column Grid:**
   - **Left: "Recent Employees"**: Last 5 active employees with avatar initials (firstName[0] + lastName[0]), name, role (capitalized), createdAt date
   - **Right: "System Status"**: 4 static indicators:
     - Employee Database → green "Online"
     - Attendance Tracking → green "Active"
     - Payroll System → green "Ready"
     - Performance Reviews → yellow "Setup Required"
     - **NOTE**: These are hardcoded strings, NOT dynamic status checks

---

### 6.2 EmployeeManagement.jsx

**Props**: None

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `showAddForm` | boolean | false |
| `selectedEmployee` | object\|null | null |
| `searchTerm` | string | '' |
| `filterDepartment` | string | 'all' |
| `isSubmitting` | boolean | false |

**Form State (`formData`):**
```
{
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  department: '',
  hourlyRate: '',
  salary: '',
  startDate: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
  notes: ''
}
```

**Employee Filtering:**
- Searches `firstName + ' ' + lastName` and `email` by searchTerm (case-insensitive)
- Filters by department (or 'all')

**Department Stats**: Counts employees per department from filtered list

**Special Feature — "Auto-Seed Mechanics" Button:**
- Hardcoded list: `['Man', 'Bob', 'Black', 'Angah', 'Hatem', 'Fuad', 'Wan']`
- Checks if each name already exists (by firstName or name field, case-insensitive)
- If not exists: creates employee with `firstName: name, lastName: '(Mechanic)', role: 'Staff', department: 'Workshop', email: {name}@onex.com, phone: '0000000000', status: 'active', hourlyRate: '0', salary: '0'`
- **NOTE**: Uses `role: 'Staff'` which is NOT in the EMPLOYEE_ROLES enum, and `department: 'Workshop'` which is NOT in EMPLOYEE_DEPARTMENTS enum

**Handlers:**
- `handleEdit(emp)`: Pre-fills form with employee data, opens modal
- `handleDelete(id)`: `window.confirm()` → calls `deleteEmployee(id)` (soft delete)
- `handleSubmit(e)`: If editing → `updateEmployee(id, formData)`. If new → `addEmployee(formData)`. Then closes form.

**UI Layout:**

1. **Stats Row** (3 cards):
   - Total Staff (blue icon) — count
   - Departments (purple icon) — unique count
   - **Add New Staff** (blue gradient action card) — clickable, opens form

2. **Table Toolbar**: Search input + "Auto-Seed Mechanics" button + Department filter dropdown

3. **Employee Table**:
   - Columns: Employee (avatar initials + name + start date) | Role / Dept (role + department badge) | Contact (email + phone) | Status (always "Active" green badge — hardcoded) | Actions (Edit ✏️ + Delete 🗑️ — shown on hover)
   - Empty state: "No staff members found matching criteria."

4. **Add/Edit Modal** (full screen overlay):
   - Sticky header: "Onboard New Staff" or "Edit Profile" + close X
   - Two-column form:
     - **Personal**: First Name* | Last Name* | Email | Phone | Address (textarea)
     - **Employment**: Role* (dropdown from EMPLOYEE_ROLES) | Department* (dropdown from EMPLOYEE_DEPARTMENTS) | Hourly Rate + Salary (side by side) | Start Date (date picker)
   - **Missing from form**: emergencyContact, emergencyPhone, notes (defined in initialFormState but NOT rendered in form UI)
   - Footer: Cancel + Save button

---

### 6.3 AttendanceTracking.jsx

**Props**: None

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `activeTab` | string | 'timeClock' |
| `selectedDate` | string | today (YYYY-MM-DD) |
| `showLeaveForm` | boolean | false |
| `loading` | boolean | false |

**Leave Request Form State:**
```
{
  employeeId: '',
  leaveType: '',
  startDate: '',
  endDate: '',
  reason: '',
  notes: ''
}
```

**Helper Functions:**
- `getEmployeeStatus(employeeId)`: Checks today's attendance → returns `'not_clocked_in'` | `'clocked_in'` | `'clocked_out'` | status
- `calculateHoursWorked(clockIn, clockOut)`: `(clockOut.toDate() - clockIn.toDate()) / (ms per hour)` → rounded to 2 decimal places

**THREE TABS:**

#### Tab 1: Time Clock
1. **Status Overview** (4 cards): Present (green) | Absent (red) | Late (yellow) | On Leave (blue) — counts from today's attendance
2. **Employee Time Clock**: One card per active employee with:
   - Avatar + Name + Role
   - Status badge: Clocked In (green) | Clocked Out (blue) | Absent (red) | Not Clocked In (gray)
   - Clock in/out times (if available)
   - Hours worked (if both times available)
   - **Clock In** button (green) → calls `clockIn(employeeId)` — visible when `not_clocked_in`
   - **Clock Out** button (blue) → calls `clockOut(employeeId, todayRecord.id)` — visible when `clocked_in`

#### Tab 2: Daily Report
1. Date picker (defaults to today)
2. Table for selected date: Employee (avatar + name) | Clock In time | Clock Out time | Hours Worked | Status badge
3. Shows N/A for missing data

#### Tab 3: Leave Requests
1. "New Leave Request" button → toggle form
2. **Leave Request Form**: Employee dropdown* | Leave Type dropdown* (from LEAVE_TYPES) | Start Date* | End Date* | Reason* | Additional Notes
3. Submits via `submitLeaveRequest(leaveForm)` from EmployeeContext
4. **Leave requests list**: Static placeholder "No leave requests — Leave requests will appear here when submitted."
5. **NOTE**: This tab does NOT display existing leave requests — it's just a form + placeholder. The actual leave request list is in LeaveManagement.jsx

---

### 6.4 LeaveManagement.jsx

**Props**: None

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `activeTab` | string | 'requests' |
| `showLeaveForm` | boolean | false |
| `selectedEmployee` | object\|null | null |
| `loading` | boolean | false |
| `leaveRequests` | array | [] |
| `leaveBalances` | object | {} |

**Enhanced Leave Form State:**
```
{
  employeeId: '',
  leaveType: '',
  startDate: '',
  endDate: '',
  totalDays: 0,
  reason: '',
  notes: '',
  isHalfDay: false,
  emergencyContact: '',
  workCoverage: '',
  attachments: []               // Defined but no upload UI exists
}
```

**Key Functions:**
- `calculateDays(start, end, isHalfDay)`: Returns `(endDate - startDate) / ms_per_day + 1` or `0.5` if half day
- `handleDateChange(field, value)`: Updates form + auto-recalculates totalDays
- `handleSubmitLeave(e)`: Creates doc in `leave_requests`. Status auto-set based on `requiresApproval` flag. Denormalizes employee name + role.
- `fetchLeaveRequests()`: `getDocs(query(collection(db, 'leave_requests')))` — sorted by appliedDate desc. Called on mount.
- `handleStatusUpdate(requestId, newStatus, adminNotes)`: Updates leave_requests doc: status, adminNotes, reviewedDate, reviewedBy ('admin')
- `calculateLeaveBalance(employeeId, leaveType)`: Filters approved requests of current year → sums totalDays → returns `{ allocated, used, remaining }`

**THREE TABS:**

#### Tab 1: Leave Requests
- Table: Employee (name + role) | Leave Type (colored badge) | Dates (start → end) | Days | Reason | Status (badge) | Actions
- Actions (for pending only): Approve (green) | Reject (red)
- Empty state when no requests

#### Tab 2: Leave Balances
- Per employee card with:
  - Avatar + Name + Role + Department
  - 6-column grid (one per leave type):
    - Type label | Remaining/Allocated | Used count | Progress bar (green if remaining > 0, red if 0)
  - Covers: Annual, Medical, Unpaid, Emergency, Maternity, Paternity

#### Tab 3: Leave Calendar
- **Placeholder only**: Shows icon + "Calendar view of all employee leave will be implemented here."
- NOT IMPLEMENTED

---

### 6.5 PayrollManagement.jsx

**Props**: None

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `selectedPeriod` | string | 'current' |
| `payPeriodStart` | string | '' (set on mount) |
| `payPeriodEnd` | string | '' (set on mount) |
| `selectedEmployeeId` | string | '' |
| `generatedPayroll` | object\|array\|null | null |
| `activeTab` | string | 'generate' |

**Pay Period Calculation (`getCurrentPayPeriod()`):**
- Bi-weekly periods starting from January 1st of current year
- `currentPeriod = floor(daysSinceJan1 / 14)`
- `periodStart = Jan 1 + (currentPeriod × 14 days)`
- `periodEnd = periodStart + 13 days`

**Bug**: Uses `useState(() => { ... }, [])` with a dependency array — `useState` doesn't take a dependency array. This is a misuse (should be `useEffect`). The initialization may still work because the callback runs once, but the `[]` parameter is silently ignored.

**Payroll Generation:**
- `handleGeneratePayroll()`: Calls `calculatePayroll(selectedEmployeeId, start, end)` for single employee. Enriches with employee object.
- `handleGenerateAllPayroll()`: Calls `calculatePayroll` for ALL active employees. Filters out those with 0 hours.

**THREE TABS:**

#### Tab 1: Generate Payroll
1. **Controls Panel** (gray background):
   - Pay Period Start (date) | Pay Period End (date) | Employee (optional dropdown — "All Employees" default) | Generate Payroll button
   - Quick period selectors: "Current Period" | "Previous Period" (14 days back)
2. **Results Table** (when generated):
   - Columns: Employee (avatar + name + role) | Hours (+ OT hours in orange) | Base Pay | Overtime | Commission | Gross Pay | Net Pay (green)
   - Summary footer (for batch): Total employees count + Total Gross Pay sum
   - Uses separate `PayrollRow` component

#### Tab 2: Payroll History
- **Placeholder only**: "No payroll history — Payroll records will appear here once you start generating payroll."
- NOT IMPLEMENTED — `calculatePayroll` never writes to Firestore

#### Tab 3: Rates & Settings
- Employee table: Employee (avatar + name) | Role | Hourly Rate ($/hr or N/A) | Annual Salary ($/yr or N/A) | Commission Eligible (Yes for mechanic/service_advisor, No for others) | "Edit Rates" link
- **"Edit Rates" button does nothing** — no onClick handler

---

### 6.6 PerformanceReviews.jsx

**Props**: None

**State:**
| Variable | Type | Default |
|----------|------|---------|
| `showReviewForm` | boolean | false |
| `loading` | boolean | false |

**Review Form State:**
```
{
  employeeId: '',
  reviewPeriod: '',              // 'quarterly' | 'semi-annual' | 'annual' | 'probationary'
  overallRating: '',
  jobKnowledge: '',
  qualityOfWork: '',
  productivity: '',
  communication: '',
  teamwork: '',
  punctuality: '',
  goals: '',
  improvements: '',
  comments: ''
}
```

**Ratings** (1–5 scale):
- 5 = Excellent
- 4 = Good
- 3 = Satisfactory
- 2 = Needs Improvement
- 1 = Unsatisfactory

**Rating Colors**:
- 5: green | 4: blue | 3: yellow | 2: orange | 1: red

**Submission**: `addPerformanceReview({ ...formData, reviewDate, ratings as parseInt })` → writes to `performance_reviews` collection

**UI Layout:**

1. **Header**: Title + "New Review" button
2. **Review Form** (when open):
   - Basic Info: Employee dropdown* | Review Period dropdown*
   - Performance Ratings (7 dropdowns, 1-5 scale): Overall Rating | Job Knowledge | Quality of Work | Productivity | Communication | Teamwork | Punctuality & Attendance
   - Text areas: Goals for Next Period | Areas for Improvement | Additional Comments
   - Cancel + Submit buttons

3. **Recent Performance Reviews**: Last 10 reviews
   - Per review card: Avatar + Name + Review Period + Overall Rating badge + Date + Comments preview (truncated to 150 chars)
   - Empty state when no reviews

4. **Review Statistics** (3 cards):
   - Average Rating (green) — mean of all overallRating values
   - Total Reviews (blue) — count
   - This Quarter (purple) — reviews where reviewDate is in current quarter

**CRITICAL BUG**: `performanceReviews` in EmployeeContext is initialized as `[]` and NEVER populated. There is NO onSnapshot listener for `performance_reviews` collection. So:
- Reviews ARE written to Firestore via `addPerformanceReview()`
- But they are NEVER read back — the list will always be empty
- The "Recent Performance Reviews" section + stats will always show empty/zero

---

## 7. PROBLEMS & GAPS

### Critical Bugs

1. **Performance Reviews never load**: No `onSnapshot` listener for `performance_reviews` collection. Data is written but never read back. The UI will always show "No performance reviews."

2. **Leave requests data mismatch**: `LEAVE_TYPES` in EmployeeContext defines `vacation/sick/personal/emergency/maternity/paternity`, but `LEAVE_CONFIGURATIONS` in LeaveManagement.jsx uses `annual/sick/unpaid/emergency/maternity/paternity` as keys. `vacation` ≠ `annual`, `personal` ≠ `unpaid`. The AttendanceTracking leave form uses LEAVE_TYPES but LeaveManagement uses LEAVE_CONFIGURATIONS directly.

3. **PayrollManagement initialization bug**: Uses `useState(() => { ... }, [])` — `useState` doesn't accept a dependency array. Should be `useEffect`.

4. **Commission calculation is placeholder**: `calculateCommission()` always returns `0`. Never integrated with the Commission 2.0 system in CustomerInvoiceCreation.

5. **Hourly rate/salary type mismatch**: Form stores as string, `calculatePayroll()` uses as number. No `parseFloat()` conversion — will produce `NaN` in calculations.

### Missing Features

6. **No payroll persistence**: `calculatePayroll()` computes in-memory only. No "Save Payroll" → Firestore. The Payroll History tab is permanently empty.

7. **Leave Calendar not implemented**: Tab 3 in LeaveManagement is a placeholder.

8. **"Edit Rates" button does nothing**: No onClick handler in PayrollManagement rates tab.

9. **Quick Action buttons do nothing**: HRDashboard has 4 quick action buttons with no onClick handlers.

10. **System Status is hardcoded**: HRDashboard shows "Online/Active/Ready/Setup Required" — these are static strings, not dynamic checks.

11. **No schedule management**: `schedules` state exists but is never populated or used.

12. **No commission rates management**: `commissionRates` state exists but is never populated or used.

13. **Leave requests not in context**: `leaveRequests` in EmployeeContext is `[]` and never populated. LeaveManagement.jsx fetches directly from Firestore, bypassing the context. AttendanceTracking's leave request list is a static placeholder.

14. **No role-based access control**: AuthContext tracks user but doesn't connect to EmployeeContext. No permissions system. Anyone with the password can do anything.

15. **Employee form missing fields**: `emergencyContact`, `emergencyPhone`, `notes` are in the form state but NOT rendered in the add/edit modal UI.

16. **Status badge always shows "Active"**: EmployeeManagement table hardcodes the "Active" badge — doesn't check `emp.status`.

### Architectural Issues

17. **Duplicate leave request submission**: Both AttendanceTracking (Tab 3) and LeaveManagement have leave request forms, using different schemas and different submit paths.

18. **Seed mechanics use wrong constants**: Auto-Seed creates employees with `role: 'Staff'` and `department: 'Workshop'` — neither exists in the enum constants.

19. **No overtime configuration**: 40-hour threshold and 1.5× multiplier are hardcoded. No setting to configure them.

20. **Tax calculation is placeholder**: Net pay = gross × 0.8 (flat 20% deduction). No real tax tables, EPF, SOCSO, or EIS calculation (required for Malaysian employment law).

21. **No payslip generation**: No PDF/print capability for payroll.

22. **No attendance auto-close**: If an employee forgets to clock out, their record stays as `clockOut: null` forever.

23. **Currency display**: PayrollManagement uses `$` symbol, but the rest of the system uses MYR (Malaysian Ringgit). Should be `RM`.
