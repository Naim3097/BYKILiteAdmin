import { useState, useEffect } from 'react'
import { useCustomer } from '../context/CustomerContext'
import { useDataJoin } from '../context/DataJoinContext'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { createCustomer } from '../utils/FirebaseDataUtils'

function CustomerDatabase({ setActiveSection }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [pastCustomers, setPastCustomers] = useState([])
  const [isLoadingPastCustomers, setIsLoadingPastCustomers] = useState(true)
  const [selectedPastCustomer, setSelectedPastCustomer] = useState(null)
  const [showPastCustomerModal, setShowPastCustomerModal] = useState(false)
  const [activeTab, setActiveTab] = useState('active')
  
  // Add Customer Modal states
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  
  const { 
    customers, 
    isLoadingCustomers, 
    customerError,
    selectCustomer 
  } = useCustomer()
  
  const { 
    joinedCustomerData, 
    isLoadingJoinedData,
    searchJoinedData 
  } = useDataJoin()

  // Filter customers based on search term
  const filteredCustomers = searchTerm 
    ? searchJoinedData(searchTerm)
    : joinedCustomerData

  // Filter past customers
  const filteredPastCustomers = searchTerm
    ? pastCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : pastCustomers

  // Fetch past customers from customer_invoices collection
  const fetchPastCustomers = async () => {
    try {
      setIsLoadingPastCustomers(true)
      console.log('🔍 Fetching past customers...')
      
      const customerInvoicesRef = collection(db, 'customer_invoices')
      
      // First, let's get all customer invoices to see what we have
      const allInvoicesQuery = query(customerInvoicesRef, orderBy('dateCreated', 'desc'))
      const allSnapshot = await getDocs(allInvoicesQuery)
      
      console.log('📊 Total customer invoices found:', allSnapshot.size)
      
      // Log first few documents to understand the structure
      let sampleCount = 0
      allSnapshot.forEach((doc) => {
        if (sampleCount < 3) {
          console.log('📄 Sample invoice:', doc.id, doc.data())
          sampleCount++
        }
      })
      
      // Now try to get paid invoices - try different approaches
      let querySnapshot
      
      // First try with paymentStatus === 'paid'
      try {
        const q = query(
          customerInvoicesRef, 
          where('paymentStatus', '==', 'paid'),
          orderBy('dateCreated', 'desc')
        )
        querySnapshot = await getDocs(q)
        console.log('💰 Paid invoices found with paymentStatus=paid:', querySnapshot.size)
      } catch (error) {
        console.log('⚠️ Query with paymentStatus failed:', error.message)
      }
      
      // If no results, try without the where clause to get all invoices
      if (!querySnapshot || querySnapshot.size === 0) {
        console.log('🔄 Trying to get all invoices since no paid ones found...')
        try {
          const allQuery = query(customerInvoicesRef, orderBy('dateCreated', 'desc'))
          querySnapshot = await getDocs(allQuery)
          console.log('� All invoices found:', querySnapshot.size)
        } catch (error) {
          console.log('❌ All invoices query failed:', error.message)
          return
        }
      }
      
      // Group invoices by customer
      const customerMap = new Map()
      
      querySnapshot.forEach((doc) => {
        const invoice = { id: doc.id, ...doc.data() }
        console.log('💳 Processing paid invoice:', invoice.invoiceNumber, invoice.paymentStatus)
        const customerId = invoice.customerId
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            name: invoice.customerName || 'Unknown Customer',
            phone: invoice.customerPhone || '',
            email: invoice.customerEmail || '',
            address: invoice.customerAddress || '',
            invoices: [],
            totalSpent: 0,
            lastInvoiceDate: null,
            invoiceCount: 0
          })
        }
        
        const customer = customerMap.get(customerId)
        customer.invoices.push(invoice)
        customer.totalSpent += invoice.customerTotal || 0
        customer.invoiceCount += 1
        
        // Update last invoice date
        const invoiceDate = invoice.dateCreated?.toDate ? invoice.dateCreated.toDate() : new Date(invoice.dateCreated)
        if (!customer.lastInvoiceDate || invoiceDate > customer.lastInvoiceDate) {
          customer.lastInvoiceDate = invoiceDate
        }
      })
      
      const pastCustomersArray = Array.from(customerMap.values())
        .sort((a, b) => (b.lastInvoiceDate || 0) - (a.lastInvoiceDate || 0))
      
      console.log('👥 Past customers processed:', pastCustomersArray.length)
      console.log('📋 Past customers array:', pastCustomersArray)
      
      setPastCustomers(pastCustomersArray)
    } catch (error) {
      console.error('❌ Error fetching past customers:', error)
    } finally {
      setIsLoadingPastCustomers(false)
    }
  }

  useEffect(() => {
    fetchPastCustomers()
  }, [])

  const handleCustomerSelect = (customer) => {
    selectCustomer(customer)
    setSelectedCustomer(customer)
    setShowCustomerModal(true)
  }

  const handleCreateInvoice = (customer) => {
    selectCustomer(customer)
    setActiveSection('customer-invoicing')
  }

  const handlePastCustomerSelect = (customer) => {
    setSelectedPastCustomer(customer)
    setShowPastCustomerModal(true)
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert('Please enter at least name and phone number')
      return
    }

    setIsSaving(true)
    try {
      await createCustomer(newCustomer)
      alert('Customer added successfully!')
      setShowAddCustomerModal(false)
      setNewCustomer({ name: '', phone: '', email: '', address: '' })
      // The customer list will auto-update via the CustomerContext listener
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('Error adding customer. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString()
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0)
  }

  if (isLoadingCustomers || isLoadingJoinedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-500 font-medium">Loading Customer Data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Customers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{joinedCustomerData.length}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Active (Recent)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {pastCustomers.filter(c => {
                 const diffTime = Math.abs(new Date() - new Date(c.lastInvoiceDate));
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 return diffDays <= 30; // Active in last 30 days
              }).length}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Avg. Spend</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {pastCustomers.length > 0 
                ? formatCurrency(pastCustomers.reduce((acc, c) => acc + c.totalSpent, 0) / pastCustomers.length)
                : 'RM 0.00'
              }
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        
       {/* Toolbar */}
       <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
         
         {/* Tabs */}
         <div className="flex p-1 bg-gray-100 rounded-lg">
           <button 
             onClick={() => setActiveTab('active')}
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
               activeTab === 'active' 
                 ? 'bg-white text-gray-900 shadow-sm' 
                 : 'text-gray-500 hover:text-gray-900'
             }`}
           >
             Active Customers
           </button>
           <button 
             onClick={() => setActiveTab('past')}
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
               activeTab === 'past' 
                 ? 'bg-white text-gray-900 shadow-sm' 
                 : 'text-gray-500 hover:text-gray-900'
             }`}
           >
             Past Transactions
           </button>
         </div>

         {/* Search & Action */}
         <div className="flex w-full md:w-auto gap-3">
           <div className="relative flex-1 md:w-64">
             <input
               type="text"
               placeholder="Search customers..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
             />
             <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
           </div>
           
           <button
             onClick={() => setShowAddCustomerModal(true)}
             className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
             </svg>
             <span className="hidden sm:inline">Add Customer</span>
           </button>
         </div>
       </div>

       {/* Table Area */}
       <div className="overflow-x-auto">
         {activeTab === 'active' ? (
           <table className="w-full text-left">
             <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
               <tr>
                 <th className="px-6 py-4">Customer Name</th>
                 <th className="px-6 py-4">Phone Number</th>
                 <th className="px-6 py-4">Email</th>
                 <th className="px-6 py-4 text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {filteredCustomers.length > 0 ? (
                 filteredCustomers.map((customer) => (
                   <tr 
                     key={customer.id} 
                     onClick={() => handleCustomerSelect(customer)}
                     className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                   >
                     <td className="px-6 py-4">
                       <div className="font-semibold text-gray-900">{customer.name}</div>
                       <div className="text-xs text-gray-400 truncate max-w-[200px]">{customer.address}</div>
                     </td>
                     <td className="px-6 py-4 text-gray-600">{customer.phone}</td>
                     <td className="px-6 py-4 text-gray-600">{customer.email || '-'}</td>
                     <td className="px-6 py-4 text-right">
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           handleCreateInvoice(customer);
                         }}
                         className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm group-hover:shadow-md"
                       >
                         Create Invoice
                       </button>
                     </td>
                   </tr>
                 ))
               ) : (
                 <tr>
                   <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                     No active customers found matching your search.
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         ) : (
           <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Total Spent</th>
                  <th className="px-6 py-4">Visits</th>
                  <th className="px-6 py-4">Last Visit</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingPastCustomers ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="loading-spinner mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredPastCustomers.length > 0 ? (
                  filteredPastCustomers.map((customer) => (
                    <tr 
                      key={customer.id} 
                      onClick={() => handlePastCustomerSelect(customer)}
                      className="hover:bg-purple-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-500">{customer.phone}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-green-600">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {customer.invoiceCount}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(customer.lastInvoiceDate)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-blue-600 text-xs font-semibold hover:underline">View History</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      No past transaction history found.
                    </td>
                  </tr>
                )}
              </tbody>
           </table>
         )}
       </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add New Customer</h3>
              <button 
                onClick={() => setShowAddCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="e.g. Ali Bin Abu"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="e.g. 0123456789"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="e.g. ali@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all h-24 resize-none"
                  placeholder="Full address..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomer}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
               <div>
                 <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                 <p className="text-sm text-blue-600 font-medium mt-1">Active Customer</p>
               </div>
               <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Phone</p>
                  <p className="text-gray-900 font-medium mt-1">{selectedCustomer.phone}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Email</p>
                  <p className="text-gray-900 font-medium mt-1 break-all">{selectedCustomer.email || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Address</p>
                <div className="bg-gray-50 p-3 rounded-lg text-gray-900">
                  {selectedCustomer.address || 'No address provided'}
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => {
                    handleCreateInvoice(selectedCustomer)
                    setShowCustomerModal(false)
                  }}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Create New Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Past Customer Modal (With History) */}
      {showPastCustomerModal && selectedPastCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start flex-shrink-0">
               <div>
                 <h2 className="text-xl font-bold text-gray-900">{selectedPastCustomer.name}</h2>
                 <p className="text-sm text-purple-600 font-medium mt-1">History & Transactions</p>
               </div>
               <button onClick={() => setShowPastCustomerModal(false)} className="text-gray-400 hover:text-gray-600">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-700 font-bold uppercase">Total Spent</p>
                    <p className="text-lg font-bold text-green-900 mt-1">{formatCurrency(selectedPastCustomer.totalSpent)}</p>
                 </div>
                 <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 font-bold uppercase">Visits</p>
                    <p className="text-lg font-bold text-blue-900 mt-1">{selectedPastCustomer.invoiceCount}</p>
                 </div>
                 <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 font-bold uppercase">Last Visited</p>
                    <p className="text-gray-900 font-bold mt-1">{formatDate(selectedPastCustomer.lastInvoiceDate)}</p>
                 </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">Transaction History</h3>
                <div className="space-y-3">
                   {selectedPastCustomer.invoices.map((inv, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                         <div className="flex justify-between items-start mb-2">
                            <div>
                               <p className="font-bold text-gray-800">#{inv.invoiceNumber}</p>
                               <p className="text-xs text-gray-500">{formatDate(inv.dateCreated?.toDate ? inv.dateCreated.toDate() : inv.dateCreated)}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-bold rounded ${
                               inv.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                               {(inv.paymentStatus || 'Unknown').toUpperCase()}
                            </span>
                         </div>
                         <div className="flex justify-between items-end">
                            <p className="text-sm text-gray-600">{inv.vehicleInfo?.make} {inv.vehicleInfo?.model} ({inv.vehicleInfo?.plate})</p>
                            <p className="font-bold text-gray-900">{formatCurrency(inv.customerTotal || inv.total)}</p>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex justify-end">
               <button 
                  onClick={() => setShowPastCustomerModal(false)}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
               >
                  Close
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CustomerDatabase