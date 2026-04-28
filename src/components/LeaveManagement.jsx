import React, { useState, useEffect } from 'react'
import { useEmployee } from '../context/EmployeeContext'
import { addDoc, collection, updateDoc, doc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebaseConfig'

function LeaveManagement() {
  const {
    employees,
    getActiveEmployees,
    LEAVE_TYPES,
    EMPLOYEE_ROLES
  } = useEmployee()

  const [activeTab, setActiveTab] = useState('requests')
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [loading, setLoading] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveBalances, setLeaveBalances] = useState({})

  // Enhanced leave form state
  const [leaveForm, setLeaveForm] = useState({
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
    attachments: []
  })

  const activeEmployees = getActiveEmployees()

  // Leave type configurations with annual allocations
  const LEAVE_CONFIGURATIONS = {
    annual: {
      label: 'Annual Leave',
      color: 'blue',
      annualAllocation: 15, // days per year for mechanics
      carryOver: true,
      requiresApproval: true
    },
    sick: {
      label: 'Medical Leave',
      color: 'red',
      annualAllocation: 15, // days per year for mechanics
      carryOver: false,
      requiresApproval: false
    },
    unpaid: {
      label: 'Unpaid Leave',
      color: 'gray',
      annualAllocation: 15, // days per year for mechanics
      carryOver: false,
      requiresApproval: true
    },
    emergency: {
      label: 'Emergency Leave',
      color: 'orange',
      annualAllocation: 5,
      carryOver: false,
      requiresApproval: true
    },
    maternity: {
      label: 'Maternity Leave',
      color: 'pink',
      annualAllocation: 90, // statutory maternity leave
      carryOver: false,
      requiresApproval: true
    },
    paternity: {
      label: 'Paternity Leave',
      color: 'green',
      annualAllocation: 14, // statutory paternity leave
      carryOver: false,
      requiresApproval: true
    }
  }

  // Calculate days between two dates
  const calculateDays = (startDate, endDate, isHalfDay = false) => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const timeDiff = end.getTime() - start.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
    return isHalfDay ? 0.5 : daysDiff
  }

  // Update total days when dates change
  const handleDateChange = (field, value) => {
    const newForm = { ...leaveForm, [field]: value }
    if (field === 'startDate' || field === 'endDate' || field === 'isHalfDay') {
      newForm.totalDays = calculateDays(
        newForm.startDate, 
        newForm.endDate, 
        newForm.isHalfDay
      )
    }
    setLeaveForm(newForm)
  }

  // Submit leave application
  const handleSubmitLeave = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const employee = employees.find(emp => emp.id === leaveForm.employeeId)
      
      await addDoc(collection(db, 'leave_requests'), {
        ...leaveForm,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeRole: employee.role,
        status: LEAVE_CONFIGURATIONS[leaveForm.leaveType].requiresApproval ? 'pending' : 'approved',
        appliedBy: 'admin', // In a real system, this would be the current user
        appliedDate: new Date().toISOString(),
        createdAt: new Date(),
        totalDays: leaveForm.totalDays
      })

      // Reset form
      setLeaveForm({
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
        attachments: []
      })
      setShowLeaveForm(false)
      
      // Refresh leave requests
      await fetchLeaveRequests()
      
      alert('Leave request submitted successfully!')
    } catch (error) {
      console.error('Error submitting leave request:', error)
      alert('Failed to submit leave request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch all leave requests
  const fetchLeaveRequests = async () => {
    try {
      const q = query(collection(db, 'leave_requests'))
      const querySnapshot = await getDocs(q)
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setLeaveRequests(requests.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)))
    } catch (error) {
      console.error('Error fetching leave requests:', error)
    }
  }

  // Update leave request status
  const handleStatusUpdate = async (requestId, newStatus, adminNotes = '') => {
    setLoading(true)
    try {
      await updateDoc(doc(db, 'leave_requests', requestId), {
        status: newStatus,
        adminNotes,
        reviewedDate: new Date().toISOString(),
        reviewedBy: 'admin' // In a real system, this would be the current user
      })
      
      await fetchLeaveRequests()
      alert(`Leave request ${newStatus} successfully!`)
    } catch (error) {
      console.error('Error updating leave request:', error)
      alert('Failed to update leave request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate leave balances for an employee
  const calculateLeaveBalance = (employeeId, leaveType) => {
    const approvedLeave = leaveRequests.filter(req => 
      req.employeeId === employeeId && 
      req.leaveType === leaveType && 
      req.status === 'approved' &&
      new Date(req.startDate).getFullYear() === new Date().getFullYear()
    )
    
    const usedDays = approvedLeave.reduce((total, req) => total + req.totalDays, 0)
    const allocation = LEAVE_CONFIGURATIONS[leaveType]?.annualAllocation || 0
    
    return {
      allocated: allocation,
      used: usedDays,
      remaining: allocation - usedDays
    }
  }

  // Load data on component mount
  useEffect(() => {
    fetchLeaveRequests()
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getLeaveTypeColor = (leaveType) => {
    const config = LEAVE_CONFIGURATIONS[leaveType]
    if (!config) return 'bg-gray-100 text-gray-800'
    
    const colors = {
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
      orange: 'bg-orange-100 text-orange-800',
      pink: 'bg-pink-100 text-pink-800',
      green: 'bg-green-100 text-green-800'
    }
    
    return colors[config.color] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-gray-600 mt-1">
              Manage employee leave requests, balances, and approvals
            </p>
          </div>
          <button
            onClick={() => setShowLeaveForm(!showLeaveForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {showLeaveForm ? 'Cancel' : 'Apply Leave'}
          </button>
        </div>
      </div>

      {/* Leave Application Form */}
      {showLeaveForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Apply for Leave</h2>
          
          <form onSubmit={handleSubmitLeave} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  required
                  value={leaveForm.employeeId}
                  onChange={(e) => setLeaveForm({...leaveForm, employeeId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Employee</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} - {employee.role?.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({...leaveForm, leaveType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Leave Type</option>
                  {Object.entries(LEAVE_CONFIGURATIONS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label} ({config.annualAllocation} days/year)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  required
                  value={leaveForm.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Half Day Option */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isHalfDay"
                checked={leaveForm.isHalfDay}
                onChange={(e) => handleDateChange('isHalfDay', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isHalfDay" className="ml-2 text-sm text-gray-700">
                Half Day Leave (0.5 days)
              </label>
            </div>

            {/* Total Days Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Total Leave Days:</span>
                <span className="text-lg font-bold text-blue-900">{leaveForm.totalDays} days</span>
              </div>
              {leaveForm.employeeId && leaveForm.leaveType && (
                <div className="mt-2 text-xs text-blue-700">
                  {(() => {
                    const balance = calculateLeaveBalance(leaveForm.employeeId, leaveForm.leaveType)
                    return `Remaining balance: ${balance.remaining} days`
                  })()}
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                  placeholder="Brief reason for leave"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={leaveForm.emergencyContact}
                  onChange={(e) => setLeaveForm({...leaveForm, emergencyContact: e.target.value})}
                  placeholder="Contact during leave"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Coverage Arrangements</label>
              <textarea
                value={leaveForm.workCoverage}
                onChange={(e) => setLeaveForm({...leaveForm, workCoverage: e.target.value})}
                rows="2"
                placeholder="How will the work be covered during leave?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                value={leaveForm.notes}
                onChange={(e) => setLeaveForm({...leaveForm, notes: e.target.value})}
                rows="3"
                placeholder="Any additional information..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowLeaveForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Requests
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'balances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Balances
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Calendar
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Leave Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {leaveRequests.length > 0 ? (
                <>
                {/* Mobile Card View — < md */}
                <div className="md:hidden space-y-3">
                  {leaveRequests.map((request) => (
                    <div key={request.id} className="bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle">
                      <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-black-10">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 break-words">{request.employeeName}</div>
                          <div className="text-xs text-gray-500 capitalize">{request.employeeRole?.replace('_', ' ')}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${getStatusColor(request.status)}`}>
                          {request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-black-50 text-xs">Type</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getLeaveTypeColor(request.leaveType)}`}>
                            {LEAVE_CONFIGURATIONS[request.leaveType]?.label || request.leaveType}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2"><span className="text-black-50 text-xs">From</span><span className="text-gray-900 text-right">{new Date(request.startDate).toLocaleDateString()}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-black-50 text-xs">To</span><span className="text-gray-900 text-right">{new Date(request.endDate).toLocaleDateString()}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-black-50 text-xs">Days</span><span className="text-gray-900 text-right">{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</span></div>
                        {request.reason && <div className="text-xs text-gray-700 break-words pt-1 border-t border-black-10"><span className="text-black-50">Reason: </span>{request.reason}</div>}
                      </div>
                      {request.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-black-10">
                          <button onClick={() => handleStatusUpdate(request.id, 'approved')} className="py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 min-h-touch">Approve</button>
                          <button onClick={() => handleStatusUpdate(request.id, 'rejected')} className="py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 min-h-touch">Reject</button>
                        </div>
                      )}
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
                          Leave Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dates
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leaveRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {request.employeeName}
                            </div>
                            <div className="text-sm text-gray-500 capitalize">
                              {request.employeeRole?.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLeaveTypeColor(request.leaveType)}`}>
                              {LEAVE_CONFIGURATIONS[request.leaveType]?.label || request.leaveType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{new Date(request.startDate).toLocaleDateString()}</div>
                            <div className="text-gray-500">to {new Date(request.endDate).toLocaleDateString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {request.reason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                              {request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {request.status === 'pending' && (
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => handleStatusUpdate(request.id, 'approved')}
                                  className="text-green-600 hover:text-green-900 text-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(request.id, 'rejected')}
                                  className="text-red-600 hover:text-red-900 text-xs"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Leave requests will appear here when submitted.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Leave Balances Tab */}
          {activeTab === 'balances' && (
            <div className="space-y-6">
              {activeEmployees.map((employee) => (
                <div key={employee.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {employee.firstName?.[0]}{employee.lastName?.[0]}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-lg font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {employee.role?.replace('_', ' ')} • {employee.department?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(LEAVE_CONFIGURATIONS).map(([leaveType, config]) => {
                      const balance = calculateLeaveBalance(employee.id, leaveType)
                      return (
                        <div key={leaveType} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                            {config.label}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {balance.remaining}/{balance.allocated}
                          </div>
                          <div className="text-xs text-gray-500">
                            {balance.used} used
                          </div>
                          <div className="mt-2">
                            <div className="bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  balance.remaining > 0 ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                style={{ 
                                  width: `${Math.min((balance.remaining / balance.allocated) * 100, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Leave Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Leave Calendar</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Calendar view of all employee leave will be implemented here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeaveManagement