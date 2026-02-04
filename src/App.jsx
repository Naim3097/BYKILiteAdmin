import { useState, useEffect, Suspense, lazy } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import LoginScreen from './components/LoginScreen'
import PaymentReceipt from './components/PaymentReceipt'
import { PartsProvider } from './context/PartsContext'
import { InvoiceProvider } from './context/InvoiceContext'
import { CustomerProvider } from './context/CustomerContext'
import { TransactionProvider } from './context/TransactionContext'
import { DataJoinProvider } from './context/DataJoinContext'
import { RepairOrderProvider } from './context/RepairOrderContext'
import { EmployeeProvider } from './context/EmployeeContext'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebaseConfig'

// Lazy load components for better performance
const PartsManagement = lazy(() => import('./components/PartsManagement'))
const InvoiceGeneration = lazy(() => import('./components/InvoiceGeneration'))
const InvoiceHistory = lazy(() => import('./components/InvoiceHistory'))

//  NEW CUSTOMER FLOW COMPONENTS (Lazy loaded)
const CustomerDatabase = lazy(() => import('./components/CustomerDatabase'))
const QuotationCreation = lazy(() => import('./components/QuotationCreation'))
const CustomerInvoiceCreation = lazy(() => import('./components/CustomerInvoiceCreation'))
const AccountingDashboard = lazy(() => import('./components/AccountingDashboard'))
const MechanicCommissionDashboard = lazy(() => import('./components/MechanicCommissionDashboard'))
const CarStatus = lazy(() => import('./components/CarStatus'))

// HR COMPONENTS (Lazy loaded)
const HRDashboard = lazy(() => import('./components/HRDashboard'))
const EmployeeManagement = lazy(() => import('./components/EmployeeManagement'))
const AttendanceTracking = lazy(() => import('./components/AttendanceTracking'))
const LeaveManagement = lazy(() => import('./components/LeaveManagement'))
const PayrollManagement = lazy(() => import('./components/PayrollManagement'))
const PerformanceReviews = lazy(() => import('./components/PerformanceReviews'))

// Loading component for Suspense
const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="loading-spinner"></div>
    <span className="ml-3 text-black-75">Loading...</span>
  </div>
)

const SECTION_TITLES = {
  'parts': 'Parts Management',
  'invoice': 'Create Invoice',
  'history': 'Invoice History',
  'customers': 'Customer Database',
  'quotation': 'Quotation Management',
  'customer-invoicing': 'Billing & Invoicing',
  'accounting': 'Financial Accounting',
  'mechanic-commissions': 'Mechanic Commissions',
  'car-status': 'Car Repair Status',
  'hr-dashboard': 'HR Dashboard',
  'employee-management': 'Employee Management',
  'attendance-tracking': 'Attendance Tracking',
  'leave-management': 'Leave Management',
  'payroll-management': 'Payroll Processing',
  'performance-reviews': 'Performance Reviews'
}

// Main App Content Component (after authentication)
function App() {
  const [activeSection, setActiveSection] = useState('parts')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isPaymentCallback, setIsPaymentCallback] = useState(false)

  useEffect(() => {
    // Check URL params first - Before Auth
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment_status') && params.get('invoice')) {
        setIsPaymentCallback(true)
        setLoading(false)
        return // Skip auth check if we are showing receipt
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
      console.log('🔐 Auth state changed:', user ? 'Logged in' : 'Logged out')
    })
    
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
         <LoadingSpinner />
      </div>
    )
  }

  if (isPaymentCallback) {
      return (
          <Suspense fallback={<LoadingSpinner />}>
              <PaymentReceipt />
          </Suspense>
      )
  }

  const handleLogout = async () => {
    try {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
      console.log('👋 Staff logged out')
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-500">Loading system...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={() => console.log('Login successful!')} />
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      // EXISTING SECTIONS
      case 'parts':
        return <PartsManagement />
      case 'invoice':
        return <InvoiceGeneration setActiveSection={setActiveSection} />
      case 'history':
        return <InvoiceHistory />
      
      // NEW CUSTOMER FLOW SECTIONS
      case 'customers':
        return <CustomerDatabase setActiveSection={setActiveSection} />
      case 'quotation':
        return <QuotationCreation setActiveSection={setActiveSection} />
      case 'customer-invoicing':
        return <CustomerInvoiceCreation setActiveSection={setActiveSection} />
      case 'accounting':
        return <AccountingDashboard />
      case 'mechanic-commissions':
        return <MechanicCommissionDashboard />
      case 'car-status':
        return <CarStatus />
      
      // HR SECTIONS
      case 'hr-dashboard':
        return <HRDashboard />
      case 'employee-management':
        return <EmployeeManagement />
      case 'attendance-tracking':
        return <AttendanceTracking />
      case 'leave-management':
        return <LeaveManagement />
      case 'payroll-management':
        return <PayrollManagement />
      case 'performance-reviews':
        return <PerformanceReviews />
      
      default:
        return <PartsManagement />
    }
  }

  return (
    <PartsProvider>
      <InvoiceProvider>
        <CustomerProvider>
          <TransactionProvider>
            <RepairOrderProvider>
              <EmployeeProvider>
                <DataJoinProvider>
                  <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
                    
                    {/* Sidebar Navigation */}
                    <Sidebar 
                      activeSection={activeSection} 
                      setActiveSection={setActiveSection}
                      isMobileOpen={isMobileSidebarOpen}
                      setIsMobileOpen={setIsMobileSidebarOpen}
                    />

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      
                      {/* Top Header */}
                      <Header 
                        onLogout={handleLogout} 
                        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                        title={SECTION_TITLES[activeSection]}
                      />
                      
                      {/* Scrollable Page Content */}
                      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        <Suspense fallback={<LoadingSpinner />}>
                          <div className="fade-in max-w-7xl mx-auto">
                            {renderActiveSection()}
                          </div>
                        </Suspense>
                      </main>
                    </div>

                  </div>
                </DataJoinProvider>
              </EmployeeProvider>
            </RepairOrderProvider>
          </TransactionProvider>
        </CustomerProvider>
      </InvoiceProvider>
    </PartsProvider>
  )
}

export default App