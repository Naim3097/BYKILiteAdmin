function Header({ onLogout, onToggleSidebar, title }) {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6 shadow-sm sticky top-0 z-30">
      <div className="flex items-center justify-between">
        
        {/* Left: Mobile Toggle & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {title || 'Dashboard'}
            </h2>
            <p className="text-xs text-gray-500 hidden sm:block">
              One X Transmission Management System
            </p>
          </div>
        </div>

        {/* Right: Date, & Logout */}
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500">Today</div>
            <div className="font-semibold text-sm text-gray-900">
              {new Date().toLocaleDateString('en-MY', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
          
          <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
              title="Logout"
            >
              <span>Logout</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
