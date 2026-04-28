import { useState } from 'react'
import { useEmployee } from '../context/EmployeeContext'

function PayrollManagement() {
  const {
    employees,
    attendanceRecords,
    payrollRecords,
    getActiveEmployees,
    calculatePayroll,
    EMPLOYEE_ROLES
  } = useEmployee()

  const [selectedPeriod, setSelectedPeriod] = useState('current')
  const [payPeriodStart, setPayPeriodStart] = useState('')
  const [payPeriodEnd, setPayPeriodEnd] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [generatedPayroll, setGeneratedPayroll] = useState(null)
  const [activeTab, setActiveTab] = useState('generate')

  const activeEmployees = getActiveEmployees()

  // Get current pay period (bi-weekly)
  const getCurrentPayPeriod = () => {
    const today = new Date()
    const startOfYear = new Date(today.getFullYear(), 0, 1)
    const daysSinceStart = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000))
    const currentPeriod = Math.floor(daysSinceStart / 14)
    
    const periodStart = new Date(startOfYear)
    periodStart.setDate(periodStart.getDate() + (currentPeriod * 14))
    
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + 13)
    
    return {
      start: periodStart.toISOString().split('T')[0],
      end: periodEnd.toISOString().split('T')[0]
    }
  }

  const handleGeneratePayroll = () => {
    if (!selectedEmployeeId || !payPeriodStart || !payPeriodEnd) {
      alert('Please select an employee and pay period')
      return
    }

    const payrollData = calculatePayroll(selectedEmployeeId, payPeriodStart, payPeriodEnd)
    if (payrollData) {
      setGeneratedPayroll({
        ...payrollData,
        employee: employees.find(emp => emp.id === selectedEmployeeId)
      })
    }
  }

  const handleGenerateAllPayroll = () => {
    if (!payPeriodStart || !payPeriodEnd) {
      alert('Please select a pay period')
      return
    }

    const allPayrollData = activeEmployees.map(employee => {
      const payrollData = calculatePayroll(employee.id, payPeriodStart, payPeriodEnd)
      return {
        ...payrollData,
        employee
      }
    }).filter(data => data.totalHours > 0) // Only include employees who worked

    setGeneratedPayroll(allPayrollData)
  }

  // Initialize current pay period on component mount
  useState(() => {
    const currentPeriod = getCurrentPayPeriod()
    setPayPeriodStart(currentPeriod.start)
    setPayPeriodEnd(currentPeriod.end)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>
            <p className="text-gray-600 mt-1">
              Generate payroll, manage compensation, and track payments
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Pay Period</div>
            <div className="text-lg font-semibold text-gray-900">
              {payPeriodStart} to {payPeriodEnd}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('generate')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'generate'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Generate Payroll
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Payroll History
            </button>
            <button
              onClick={() => setActiveTab('rates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Rates & Settings
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Generate Payroll Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              {/* Payroll Generation Controls */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Generation</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pay Period Start</label>
                    <input
                      type="date"
                      value={payPeriodStart}
                      onChange={(e) => setPayPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pay Period End</label>
                    <input
                      type="date"
                      value={payPeriodEnd}
                      onChange={(e) => setPayPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee (Optional)</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Employees</option>
                      {activeEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={selectedEmployeeId ? handleGeneratePayroll : handleGenerateAllPayroll}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Generate Payroll
                    </button>
                  </div>
                </div>

                {/* Quick Period Selectors */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const currentPeriod = getCurrentPayPeriod()
                      setPayPeriodStart(currentPeriod.start)
                      setPayPeriodEnd(currentPeriod.end)
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    Current Period
                  </button>
                  <button
                    onClick={() => {
                      const currentPeriod = getCurrentPayPeriod()
                      const prevStart = new Date(currentPeriod.start)
                      prevStart.setDate(prevStart.getDate() - 14)
                      const prevEnd = new Date(currentPeriod.end)
                      prevEnd.setDate(prevEnd.getDate() - 14)
                      setPayPeriodStart(prevStart.toISOString().split('T')[0])
                      setPayPeriodEnd(prevEnd.toISOString().split('T')[0])
                    }}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Previous Period
                  </button>
                </div>
              </div>

              {/* Generated Payroll Results */}
              {generatedPayroll && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Payroll Results: {payPeriodStart} to {payPeriodEnd}
                    </h3>
                  </div>

                  {/* Mobile Card View — < md */}
                  <div className="md:hidden p-3 space-y-3">
                    {(Array.isArray(generatedPayroll) ? generatedPayroll : [generatedPayroll]).map((p) => (
                      <div key={p.employeeId} className="bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle">
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-black-10">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-gray-600">{p.employee?.firstName?.[0]}{p.employee?.lastName?.[0]}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 break-words">{p.employee?.firstName} {p.employee?.lastName}</div>
                            <div className="text-xs text-gray-500 capitalize">{p.employee?.role?.replace('_',' ')}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-black-50">Net Pay</div>
                            <div className="font-bold text-green-600">${p.netPay?.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><div className="text-xs text-black-50">Hours</div><div>{p.hoursWorked || 0}</div></div>
                          <div><div className="text-xs text-black-50">Base Pay</div><div>${p.basePay?.toFixed(2)}</div></div>
                          <div><div className="text-xs text-black-50">Overtime</div><div>${p.overtimePay?.toFixed(2) || '0.00'}</div></div>
                          <div><div className="text-xs text-black-50">Commission</div><div>${p.commission?.toFixed(2) || '0.00'}</div></div>
                          <div className="col-span-2 pt-2 border-t border-black-10"><div className="text-xs text-black-50">Gross Pay</div><div className="font-semibold">${p.grossPay?.toFixed(2)}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table — md+ */}
                  <div className="hidden md:block overflow-x-auto touch-scroll">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Employee
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hours
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Base Pay
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Overtime
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Commission
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Gross Pay
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Net Pay
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.isArray(generatedPayroll) ? (
                          generatedPayroll.map((payroll) => (
                            <PayrollRow key={payroll.employeeId} payroll={payroll} />
                          ))
                        ) : (
                          <PayrollRow payroll={generatedPayroll} />
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  {Array.isArray(generatedPayroll) && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          Total employees: {generatedPayroll.length}
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          Total Gross Pay: ${generatedPayroll.reduce((sum, p) => sum + p.grossPay, 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payroll History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Payroll History</h3>
              </div>

              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No payroll history</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Payroll records will appear here once you start generating payroll.
                </p>
              </div>
            </div>
          )}

          {/* Rates & Settings Tab */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Employee Rates & Settings</h3>

              {/* Mobile Card View — < md */}
              <div className="md:hidden space-y-3">
                {activeEmployees.map((employee) => (
                  <div key={employee.id} className="bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-black-10">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-gray-600">{employee.firstName?.[0]}{employee.lastName?.[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 break-words">{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-gray-500 capitalize">{employee.role?.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2"><span className="text-black-50 text-xs">Hourly</span><span className="text-gray-900">{employee.hourlyRate ? `$${employee.hourlyRate}/hr` : 'N/A'}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-black-50 text-xs">Annual</span><span className="text-gray-900">{employee.salary ? `$${employee.salary.toLocaleString()}/yr` : 'N/A'}</span></div>
                      <div className="flex justify-between gap-2">
                        <span className="text-black-50 text-xs">Commission</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${employee.role === EMPLOYEE_ROLES.MECHANIC || employee.role === EMPLOYEE_ROLES.SERVICE_ADVISOR ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {employee.role === EMPLOYEE_ROLES.MECHANIC || employee.role === EMPLOYEE_ROLES.SERVICE_ADVISOR ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    <button className="mt-3 w-full py-2 bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-100 min-h-touch">Edit Rates</button>
                  </div>
                ))}
              </div>

              {/* Desktop Table — md+ */}
              <div className="hidden md:block overflow-x-auto touch-scroll">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hourly Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Annual Salary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commission Eligible
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-600">
                                {employee.firstName?.[0]}{employee.lastName?.[0]}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.firstName} {employee.lastName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {employee.role?.replace('_', ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.hourlyRate ? `$${employee.hourlyRate}/hr` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {employee.salary ? `$${employee.salary.toLocaleString()}/yr` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            employee.role === EMPLOYEE_ROLES.MECHANIC || employee.role === EMPLOYEE_ROLES.SERVICE_ADVISOR
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.role === EMPLOYEE_ROLES.MECHANIC || employee.role === EMPLOYEE_ROLES.SERVICE_ADVISOR
                              ? 'Yes' : 'No'
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900">
                            Edit Rates
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// PayrollRow Component
function PayrollRow({ payroll }) {
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {payroll.employee?.firstName?.[0]}{payroll.employee?.lastName?.[0]}
            </span>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {payroll.employee?.firstName} {payroll.employee?.lastName}
            </div>
            <div className="text-sm text-gray-500 capitalize">
              {payroll.employee?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {payroll.totalHours?.toFixed(2)} hrs
        {payroll.overtimeHours > 0 && (
          <div className="text-xs text-orange-600">
            ({payroll.overtimeHours?.toFixed(2)} OT)
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${payroll.basePay?.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${payroll.overtimePay?.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        ${payroll.commission?.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${payroll.grossPay?.toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
        ${payroll.netPay?.toFixed(2)}
      </td>
    </tr>
  )
}

export default PayrollManagement