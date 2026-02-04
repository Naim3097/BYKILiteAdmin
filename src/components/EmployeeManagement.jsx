import { useState } from 'react'
import { useEmployee } from '../context/EmployeeContext'

function EmployeeManagement() {
  const {
    employees,
    activeEmployees,
    employeeLoading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    EMPLOYEE_ROLES,
    EMPLOYEE_DEPARTMENTS
  } = useEmployee()

  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form Initial State
  const initialFormState = {
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

  const [formData, setFormData] = useState(initialFormState)

  // --- Filtering & Stats ---
  const filteredEmployees = employees.filter(emp => {
     const matchesSearch = (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase())
     const matchesDept = filterDepartment === 'all' || emp.department === filterDepartment
     return matchesSearch && matchesDept
  })

  const totalEmployees = employees.length
  // Assuming activeEmployees is an array or I can filter by status if available. 
  // Code snippet imported activeEmployees but typically context provides a list or a function.
  // The snippet showed `getActiveEmployees` as a function but I didn't see it called. 
  // I will assume employees have a status or just use total length.
  const deptCounts = filteredEmployees.reduce((acc, curr) => {
     acc[curr.department] = (acc[curr.department] || 0) + 1
     return acc
  }, {})

  // --- Handlers ---
  const handleEdit = (emp) => {
     setFormData({ ...initialFormState, ...emp })
     setSelectedEmployee(emp)
     setShowAddForm(true)
  }

  const handleDelete = async (id) => {
     if (window.confirm("Are you sure you want to remove this employee?")) {
        await deleteEmployee(id)
     }
  }

  const handleSeedMechanics = async () => {
      if (!window.confirm("Quickly add missing mechanics (Man, Bob, Black, Angah, Hatem, Fuad, Wan)?")) return;
      
      const targetMechanics = ['Man', 'Bob', 'Black', 'Angah', 'Hatem', 'Fuad', 'Wan']
      let addedCount = 0
      
      setIsSubmitting(true)
      try {
          for (const name of targetMechanics) {
              const exists = employees.some(e => 
                  (e.firstName && e.firstName.toLowerCase() === name.toLowerCase()) || 
                  (e.name && e.name.toLowerCase() === name.toLowerCase())
              )
              
              if (!exists) {
                  await addEmployee({
                      firstName: name,
                      lastName: '(Mechanic)',
                      role: 'Staff',
                      department: 'Workshop',
                      email: `${name.toLowerCase()}@onex.com`, // Dummy email
                      phone: '0000000000',
                      status: 'active',
                      hourlyRate: '0',
                      salary: '0'
                  })
                  addedCount++
              }
          }
          if (addedCount > 0) alert(`Added ${addedCount} new mechanics.`)
          else alert("All mechanics already exist.")
      } catch (e) {
          console.error(e)
          alert("Error adding mechanics: " + e.message)
      } finally {
          setIsSubmitting(false)
      }
  }

  const handleSubmit = async (e) => {
     e.preventDefault()
     setIsSubmitting(true)
     try {
        if (selectedEmployee) {
           await updateEmployee(selectedEmployee.id, formData)
        } else {
           await addEmployee(formData)
        }
        setShowAddForm(false)
        setFormData(initialFormState)
        setSelectedEmployee(null)
     } catch (err) {
        alert("Operation failed: " + err.message)
     } finally {
        setIsSubmitting(false)
     }
  }

  if (employeeLoading && employees.length === 0) {
     return <div className="p-12 text-center text-gray-500">Loading Staff Data...</div>
  }

  return (
    <div className="space-y-6">
       
       {/* Stats Header */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Staff</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{totalEmployees}</h3>
             </div>
             <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Departments</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{Object.keys(deptCounts).length}</h3>
             </div>
             <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
             </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-xl shadow-lg shadow-blue-200 text-white cursor-pointer hover:shadow-xl transition-all" onClick={() => { setFormData(initialFormState); setSelectedEmployee(null); setShowAddForm(true); }}>
             <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full">
                   <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                </div>
                <div>
                   <h3 className="text-lg font-bold">Add New Staff</h3>
                   <p className="text-blue-100 text-sm">Onboard a new employee</p>
                </div>
             </div>
          </div>
       </div>

       {/* Content */}
       <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
             <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                   <input 
                      type="text" 
                      placeholder="Search staff..." 
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:outline-none"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                   />
                   <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button 
                    onClick={handleSeedMechanics}
                    disabled={isSubmitting}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 border border-gray-300"
                    title="Quick Add: Man, Bob, Black, Angah, Hatem, Fuad, Wan"
                >
                    + Auto-Seed Mechanics
                </button>
                <select 
                  className="py-2 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                >
                   <option value="all">All Depts</option>
                   {Object.values(EMPLOYEE_DEPARTMENTS).map(d => (
                      <option key={d} value={d}>{d}</option>
                   ))}
                </select>
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                   <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Role / Dept</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {filteredEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors group">
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-bold border border-gray-200">
                                  {emp.firstName?.[0]}{emp.lastName?.[0]}
                               </div>
                               <div>
                                  <p className="font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-gray-500">Since {emp.startDate ? new Date(emp.startDate).toLocaleDateString() : 'N/A'}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <p className="font-medium text-gray-800">{emp.role?.replace(/_/g, ' ')}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded tracking-wide">{emp.department}</span>
                         </td>
                         <td className="px-6 py-4">
                            <p className="text-sm text-gray-600 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {emp.email}</p>
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {emp.phone}</p>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full uppercase">Active</span>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => handleEdit(emp)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                               <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                         </td>
                      </tr>
                   ))}
                   {filteredEmployees.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No staff members found matching criteria.</td></tr>
                   )}
                </tbody>
             </table>
          </div>
       </div>

       {/* Form Modal */}
       {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                   <h3 className="text-xl font-bold text-gray-900">{selectedEmployee ? 'Edit Profile' : 'Onboard New Staff'}</h3>
                   <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Personal Info */}
                      <div className="space-y-4">
                         <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Personal</h4>
                         <input required placeholder="First Name" className="w-full p-2 border rounded-lg" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                         <input required placeholder="Last Name" className="w-full p-2 border rounded-lg" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                         <input type="email" placeholder="Email" className="w-full p-2 border rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                         <input type="tel" placeholder="Phone" className="w-full p-2 border rounded-lg" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                         <textarea placeholder="Address" className="w-full p-2 border rounded-lg h-24" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                      </div>

                      {/* Job Info */}
                      <div className="space-y-4">
                         <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Employment</h4>
                         <select required className="w-full p-2 border rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                            <option value="">-- Role --</option>
                            {Object.entries(EMPLOYEE_ROLES).map(([k,v]) => <option key={k} value={v}>{v}</option>)}
                         </select>
                         <select required className="w-full p-2 border rounded-lg" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                            <option value="">-- Dept --</option>
                            {Object.entries(EMPLOYEE_DEPARTMENTS).map(([k,v]) => <option key={k} value={v}>{v}</option>)}
                         </select>
                         <div className="grid grid-cols-2 gap-2">
                             <input type="number" placeholder="Hourly Rate ($)" className="p-2 border rounded-lg" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} />
                             <input type="number" placeholder="Salary ($)" className="p-2 border rounded-lg" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
                         </div>
                         <input type="date" className="w-full p-2 border rounded-lg" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                      </div>
                   </div>

                   <div className="pt-4 flex gap-4">
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-gray-100 rounded-lg font-bold text-gray-600 hover:bg-gray-200">Cancel</button>
                      <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg">{isSubmitting ? 'Saving...' : 'Save Employee Profile'}</button>
                   </div>
                </form>
             </div>
          </div>
       )}
    </div>
  )
}

export default EmployeeManagement
