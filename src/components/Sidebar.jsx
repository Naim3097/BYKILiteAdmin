import { useState } from 'react'

const Sidebar = ({ activeSection, setActiveSection, isMobileOpen, setIsMobileOpen }) => {
  const [expandedGroups, setExpandedGroups] = useState({
    'Spare Parts': true,
    'Customer': true,
    'Human Resources': false // Default closed to save space maybe? Or all open.
  })

  const navigationGroups = [
    {
      title: 'Spare Parts',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      sections: [
        { id: 'parts', label: 'Parts Management' },
        { id: 'invoice', label: 'Create Invoice' },
        { id: 'history', label: 'Invoice History' }
      ]
    },
    {
      title: 'Customer',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      sections: [
        { id: 'customers', label: 'Customer Database' },
        { id: 'car-status', label: 'Car Status' },
        { id: 'quotation', label: 'Quotations' },
        { id: 'customer-invoicing', label: 'Billing & Invoices' },
        { id: 'accounting', label: 'Accounting' },
        { id: 'mechanic-commissions', label: 'Mechanic Commissions' }
      ]
    },
    {
      title: 'Human Resources',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      sections: [
        { id: 'hr-dashboard', label: 'Dashboard' },
        { id: 'employee-management', label: 'Employees' },
        { id: 'attendance-tracking', label: 'Attendance' },
        { id: 'leave-management', label: 'Leaves' },
        { id: 'payroll-management', label: 'Payroll' },
        { id: 'performance-reviews', label: 'Reviews' }
      ]
    }
  ]

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }))
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:h-screen lg:flex lg:flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              B
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">BYKI Lite</h1>
              <p className="text-xs text-slate-400">Business Manager</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navigationGroups.map((group) => (
            <div key={group.title}>
              <button 
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 hover:text-white transition-colors"
                style={{minHeight: '24px'}} // Touch target size
              >
                <div className="flex items-center gap-2">
                  {group.icon}
                  {group.title}
                </div>
                <svg 
                  className={`w-3 h-3 transition-transform ${expandedGroups[group.title] ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedGroups[group.title] && (
                <div className="space-y-1">
                  {group.sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id)
                        setIsMobileOpen(false)
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2
                        ${activeSection === section.id 
                          ? 'bg-blue-600 text-white font-medium shadow-md' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeSection === section.id ? 'bg-white' : 'bg-slate-600'}`}></span>
                      {section.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer / User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                 <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                 </svg>
              </div>
              <div>
                 <p className="text-sm font-medium text-white">Staff Member</p>
                 <p className="text-xs text-green-400">Online</p>
              </div>
           </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
