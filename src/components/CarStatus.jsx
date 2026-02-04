import { useState, useEffect } from 'react'
import { useRepairOrder, STATUS_LABELS, STATUS_COLORS, REPAIR_STATUSES } from '../context/RepairOrderContext'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../firebaseConfig'

function CarStatus() {
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [bykiStatusData, setBykiStatusData] = useState([])
  const [isLoadingBykiStatus, setIsLoadingBykiStatus] = useState(true)
  const [bykiStatusError, setBykiStatusError] = useState(null)
  
  const {
    repairOrders,
    isLoadingOrders,
    orderError,
    statusCounts,
    getOrdersByStatus,
    formatDate
  } = useRepairOrder()

  // Firestore connection to byki_status collection
  useEffect(() => {
    try {
      const bykiStatusRef = collection(db, 'byki_status')
      const bykiStatusQuery = query(bykiStatusRef, orderBy('createdAt', 'desc'))
      
      const unsubscribe = onSnapshot(bykiStatusQuery, (snapshot) => {
        const statusData = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          statusData.push({
            id: doc.id,
            ...data
          })
        })
        
        setBykiStatusData(statusData)
        setIsLoadingBykiStatus(false)
        setBykiStatusError(null)
      }, (error) => {
        console.error(' Error loading byki_status collection:', error)
        setBykiStatusError(error.message)
        setIsLoadingBykiStatus(false)
      })
      
      return () => {
        unsubscribe()
      }
    } catch (error) {
      console.error(' Error setting up byki_status listener:', error)
      setBykiStatusError(error.message)
      setIsLoadingBykiStatus(false)
    }
  }, [])

  // Filter orders based on selected status and search term
  const getFilteredOrders = () => {
    let filtered = selectedStatus === 'all' 
      ? repairOrders 
      : getOrdersByStatus(selectedStatus)
    
    if (searchTerm) {
      filtered = filtered.filter(order => 
        (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.vehicleInfo?.make && order.vehicleInfo.make.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.vehicleInfo?.model && order.vehicleInfo.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.vehicleInfo?.licensePlate && order.vehicleInfo.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    
    return filtered
  }

  const filteredOrders = getFilteredOrders()

  // Get progress percentage for status
  const getStatusProgress = (status) => {
    const statusOrder = [
      REPAIR_STATUSES.NOT_STARTED,
      REPAIR_STATUSES.UNDER_INSPECTION,
      REPAIR_STATUSES.INSPECTION_COMPLETED,
      REPAIR_STATUSES.REPAIR_ONGOING,
      REPAIR_STATUSES.READY_FOR_PICKUP
    ]
    
    const index = statusOrder.indexOf(status)
    if (index === -1) return 0
    return ((index + 1) / statusOrder.length) * 100
  }
  
  // Define status colors for badges (Tailwind classes)
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case REPAIR_STATUSES.NOT_STARTED: return 'bg-gray-100 text-gray-700 border-gray-200';
      case REPAIR_STATUSES.UNDER_INSPECTION: return 'bg-blue-50 text-blue-700 border-blue-200';
      case REPAIR_STATUSES.INSPECTION_COMPLETED: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case REPAIR_STATUSES.REPAIR_ONGOING: return 'bg-orange-50 text-orange-700 border-orange-200';
      case REPAIR_STATUSES.READY_FOR_PICKUP: return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  if (isLoadingOrders) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-500 font-medium">Loading Workshop Data...</p>
        </div>
      </div>
    )
  }

  if (orderError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto mt-10">
        <p className="text-red-700 font-medium mb-2">Unable to load data</p>
        <p className="text-red-600 text-sm mb-4">{orderError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
           <div 
             key={status}
             onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
             className={`p-4 rounded-xl border cursor-pointer transition-all ${
               selectedStatus === status 
                 ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200' 
                 : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
             }`}
           >
             <div className="flex justify-between items-start mb-2">
               <div className={`p-1.5 rounded-lg ${
                 status === REPAIR_STATUSES.READY_FOR_PICKUP ? 'bg-green-100 text-green-600' :
                 status === REPAIR_STATUSES.REPAIR_ONGOING ? 'bg-orange-100 text-orange-600' :
                 'bg-gray-100 text-gray-600'
               }`}>
                  {status === REPAIR_STATUSES.REPAIR_ONGOING ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : status === REPAIR_STATUSES.READY_FOR_PICKUP ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
               </div>
               <span className="text-2xl font-bold text-gray-900">{statusCounts[status] || 0}</span>
             </div>
             <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
           </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">
              {selectedStatus === 'all' ? 'All Vehicles' : STATUS_LABELS[selectedStatus]}
            </h3>
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
              {filteredOrders.length}
            </span>
          </div>

          <div className="w-full md:w-auto flex gap-3">
             <div className="relative flex-1 md:w-72">
               <input
                 type="text"
                 placeholder="Search vehicle, plate or customer..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
               />
               <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Vehicle Details</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4 w-1/4">Status & Progress</th>
                <th className="px-6 py-4">Last Update</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                         </div>
                         <div>
                           <p className="font-bold text-gray-900">{order.vehicleInfo?.make} {order.vehicleInfo?.model}</p>
                           <p className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                             {order.vehicleInfo?.licensePlate || 'NO PLATE'}
                           </p>
                         </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{order.customerName}</p>
                      <p className="text-xs text-gray-500">Owner</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <span className={`self-start px-2.5 py-1 text-xs font-bold rounded-lg border ${getStatusBadgeColor(order.repairStatus)}`}>
                          {STATUS_LABELS[order.repairStatus] || 'Unknown'}
                        </span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              order.repairStatus === REPAIR_STATUSES.READY_FOR_PICKUP ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${getStatusProgress(order.repairStatus)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(order.lastUpdated)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-blue-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                       <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                       </div>
                       <p className="font-medium">No vehicles found</p>
                       <p className="text-sm mt-1">Try adjusting your search or filter</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default CarStatus
