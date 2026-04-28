import { useState } from 'react'
import { useEmployee } from '../context/EmployeeContext'

function AttendanceTracking() {
  const {
    employees,
    attendanceRecords,
    getActiveEmployees,
    clockIn,
    clockOut,
    submitLeaveRequest,
    getTodaysAttendance,
    ATTENDANCE_STATUS,
    LEAVE_TYPES
  } = useEmployee()

  const [activeTab, setActiveTab] = useState('timeClock')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Leave request form state
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  })

  const activeEmployees = getActiveEmployees()
  const todaysAttendance = getTodaysAttendance()

  // Get attendance for selected date
  const selectedDateAttendance = attendanceRecords.filter(record => 
    record.date === selectedDate
  )

  const handleClockIn = async (employeeId) => {
    setLoading(true)
    try {
      await clockIn(employeeId)
    } catch (error) {
      console.error('Error clocking in:', error)
      alert('Failed to clock in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async (employeeId, attendanceId) => {
    setLoading(true)
    try {
      await clockOut(employeeId, attendanceId)
    } catch (error) {
      console.error('Error clocking out:', error)
      alert('Failed to clock out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await submitLeaveRequest(leaveForm)
      setLeaveForm({
        employeeId: '',
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        notes: ''
      })
      setShowLeaveForm(false)
    } catch (error) {
      console.error('Error submitting leave request:', error)
      alert('Failed to submit leave request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getEmployeeStatus = (employeeId) => {
    const todayRecord = todaysAttendance.find(record => record.employeeId === employeeId)
    if (!todayRecord) return 'not_clocked_in'
    if (todayRecord.clockIn && !todayRecord.clockOut) return 'clocked_in'
    if (todayRecord.clockIn && todayRecord.clockOut) return 'clocked_out'
    return todayRecord.status
  }

  const calculateHoursWorked = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 0
    const hours = (clockOut.toDate() - clockIn.toDate()) / (1000 * 60 * 60)
    return Math.round(hours * 100) / 100
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance & Scheduling</h1>
            <p className="text-gray-600 mt-1">
              Manage employee time tracking and leave requests
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Time</div>
            <div className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('timeClock')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'timeClock'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Time Clock
            </button>
            <button
              onClick={() => setActiveTab('dailyReport')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dailyReport'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Daily Report
            </button>
            <button
              onClick={() => setActiveTab('leaveRequests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'leaveRequests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Leave Requests
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Time Clock Tab */}
          {activeTab === 'timeClock' && (
            <div className="space-y-6">
              {/* Today's Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-800 text-sm font-medium">Present</div>
                  <div className="text-2xl font-bold text-green-900">
                    {todaysAttendance.filter(r => r.status === ATTENDANCE_STATUS.PRESENT).length}
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-red-800 text-sm font-medium">Absent</div>
                  <div className="text-2xl font-bold text-red-900">
                    {todaysAttendance.filter(r => r.status === ATTENDANCE_STATUS.ABSENT).length}
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-yellow-800 text-sm font-medium">Late</div>
                  <div className="text-2xl font-bold text-yellow-900">
                    {todaysAttendance.filter(r => r.status === ATTENDANCE_STATUS.LATE).length}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-blue-800 text-sm font-medium">On Leave</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {todaysAttendance.filter(r => r.status === ATTENDANCE_STATUS.ON_LEAVE).length}
                  </div>
                </div>
              </div>

              {/* Employee Clock In/Out */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Employee Time Clock</h3>
                <div className="grid gap-4">
                  {activeEmployees.map((employee) => {
                    const status = getEmployeeStatus(employee.id)
                    const todayRecord = todaysAttendance.find(record => record.employeeId === employee.id)
                    
                    return (
                      <div key={employee.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {employee.firstName?.[0]}{employee.lastName?.[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {employee.role?.replace('_', ' ')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          {/* Status Badge */}
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'clocked_in' ? 'bg-green-100 text-green-800' :
                            status === 'clocked_out' ? 'bg-blue-100 text-blue-800' :
                            status === 'absent' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {status === 'clocked_in' ? 'Clocked In' :
                             status === 'clocked_out' ? 'Clocked Out' :
                             status === 'absent' ? 'Absent' :
                             'Not Clocked In'}
                          </div>

                          {/* Clock In/Out Time */}
                          {todayRecord && (
                            <div className="text-xs text-gray-500">
                              {todayRecord.clockIn && (
                                <div>In: {todayRecord.clockIn.toDate().toLocaleTimeString()}</div>
                              )}
                              {todayRecord.clockOut && (
                                <div>Out: {todayRecord.clockOut.toDate().toLocaleTimeString()}</div>
                              )}
                              {todayRecord.clockIn && todayRecord.clockOut && (
                                <div className="font-medium">
                                  Hours: {calculateHoursWorked(todayRecord.clockIn, todayRecord.clockOut)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex space-x-2">
                            {status === 'not_clocked_in' && (
                              <button
                                onClick={() => handleClockIn(employee.id)}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                Clock In
                              </button>
                            )}
                            {status === 'clocked_in' && (
                              <button
                                onClick={() => handleClockOut(employee.id, todayRecord.id)}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                Clock Out
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Daily Report Tab */}
          {activeTab === 'dailyReport' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Daily Attendance Report</h3>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Mobile Card View — < md */}
              <div className="md:hidden space-y-3">
                {activeEmployees.map((employee) => {
                  const record = selectedDateAttendance.find(r => r.employeeId === employee.id)
                  const statusClass = record?.status === ATTENDANCE_STATUS.PRESENT ? 'bg-green-100 text-green-800' :
                    record?.status === ATTENDANCE_STATUS.ABSENT ? 'bg-red-100 text-red-800' :
                    record?.status === ATTENDANCE_STATUS.LATE ? 'bg-yellow-100 text-yellow-800' :
                    record?.status === ATTENDANCE_STATUS.ON_LEAVE ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  return (
                    <div key={employee.id} className="bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle">
                      <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-black-10">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-gray-600">{employee.firstName?.[0]}{employee.lastName?.[0]}</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 break-words min-w-0">{employee.firstName} {employee.lastName}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${statusClass}`}>
                          {record?.status ? record.status.replace('_', ' ') : 'No Record'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div><div className="text-xs text-black-50">In</div><div className="text-gray-900">{record?.clockIn ? record.clockIn.toDate().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}</div></div>
                        <div><div className="text-xs text-black-50">Out</div><div className="text-gray-900">{record?.clockOut ? record.clockOut.toDate().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}</div></div>
                        <div><div className="text-xs text-black-50">Hours</div><div className="text-gray-900 font-semibold">{record?.clockIn && record?.clockOut ? calculateHoursWorked(record.clockIn, record.clockOut) : '—'}</div></div>
                      </div>
                    </div>
                  )
                })}
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
                        Clock In
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clock Out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hours Worked
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeEmployees.map((employee) => {
                      const record = selectedDateAttendance.find(r => r.employeeId === employee.id)
                      return (
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record?.clockIn ? record.clockIn.toDate().toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record?.clockOut ? record.clockOut.toDate().toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record?.clockIn && record?.clockOut 
                              ? `${calculateHoursWorked(record.clockIn, record.clockOut)} hrs`
                              : 'N/A'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              record?.status === ATTENDANCE_STATUS.PRESENT ? 'bg-green-100 text-green-800' :
                              record?.status === ATTENDANCE_STATUS.ABSENT ? 'bg-red-100 text-red-800' :
                              record?.status === ATTENDANCE_STATUS.LATE ? 'bg-yellow-100 text-yellow-800' :
                              record?.status === ATTENDANCE_STATUS.ON_LEAVE ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {record?.status ? record.status.replace('_', ' ') : 'No Record'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leave Requests Tab */}
          {activeTab === 'leaveRequests' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Leave Requests</h3>
                <button
                  onClick={() => setShowLeaveForm(!showLeaveForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {showLeaveForm ? 'Cancel' : 'New Leave Request'}
                </button>
              </div>

              {/* Leave Request Form */}
              {showLeaveForm && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Submit Leave Request</h4>
                  <form onSubmit={handleLeaveRequest} className="space-y-4">
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
                              {employee.firstName} {employee.lastName}
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
                          {Object.entries(LEAVE_TYPES).map(([key, value]) => (
                            <option key={key} value={value}>
                              {value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                          onChange={(e) => setLeaveForm({...leaveForm, startDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                        <input
                          type="date"
                          required
                          value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({...leaveForm, endDate: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                      <input
                        type="text"
                        required
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Brief reason for leave"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                      <textarea
                        value={leaveForm.notes}
                        onChange={(e) => setLeaveForm({...leaveForm, notes: e.target.value})}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Any additional details..."
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
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
                        {loading ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Leave Requests List - Placeholder */}
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Leave requests will appear here when submitted.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AttendanceTracking