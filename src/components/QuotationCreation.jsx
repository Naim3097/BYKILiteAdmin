import React, { useState, useEffect } from 'react'
import { useCustomer } from '../context/CustomerContext'
import { createQuotation, updateQuotation } from '../utils/FirebaseDataUtils'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import PDFGenerator from '../utils/PDFGenerator'

function QuotationCreation({ setActiveSection }) {
  console.log(' QuotationCreation component mounting...')
  
  const [viewMode, setViewMode] = useState('list') // 'list' or 'form'
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showViewQuotationModal, setShowViewQuotationModal] = useState(false)
  const [selectedQuotationForView, setSelectedQuotationForView] = useState(null)
  
  // Quotation form states
  const [manualParts, setManualParts] = useState([])
  const [laborCharges, setLaborCharges] = useState([])
  const [workDescription, setWorkDescription] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState({ make: '', model: '', year: '', plate: '' })
  const [validityDays, setValidityDays] = useState(30)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Quote valid for 30 days. Prices subject to change.')
  
  const [quotationHistory, setQuotationHistory] = useState([])
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isSaving, setIsSaving] = useState(false)

  const { customers = [] } = useCustomer() || {}

  // Load quotation history
  useEffect(() => {
    setIsLoadingQuotations(true)
    try {
      const quotationsQuery = query(
        collection(db, 'quotations'),
        orderBy('dateCreated', 'desc')
      )
      
      const unsubscribe = onSnapshot(quotationsQuery, (snapshot) => {
        const quotations = []
        snapshot.forEach((doc) => {
          quotations.push({
            id: doc.id,
            ...doc.data(),
            dateCreated: doc.data().dateCreated?.toDate() || new Date(),
            validUntil: doc.data().validUntil?.toDate() || new Date()
          })
        })
        setQuotationHistory(quotations)
        setIsLoadingQuotations(false)
      })
      
      return () => unsubscribe()
    } catch (error) {
      console.error('Error loading quotations:', error)
      setIsLoadingQuotations(false)
    }
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0)
  }

  const formatDate = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString()
  }

  // --- Calculations for Stats Cards ---
  const getStats = () => {
    const totalQuotes = quotationHistory.length
    const pendingQuotes = quotationHistory.filter(q => q.status === 'pending')
    const acceptedQuotes = quotationHistory.filter(q => q.status === 'accepted')
    const pendingValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0)
    
    return {
      total: totalQuotes,
      pendingCount: pendingQuotes.length,
      acceptedCount: acceptedQuotes.length,
      pendingValue: pendingValue
    }
  }
  const stats = getStats()

  // Manual parts functions
  const addManualPart = () => {
    setManualParts([...manualParts, {
      sku: '',
      partName: '',
      quantity: 1,
      pricePerUnit: 0,
      total: 0
    }])
  }

  const updateManualPart = (index, field, value) => {
    const updated = [...manualParts]
    updated[index][field] = value
    
    // Auto-calculate total
    if (field === 'quantity' || field === 'pricePerUnit') {
      updated[index].total = updated[index].quantity * updated[index].pricePerUnit
    }
    
    setManualParts(updated)
  }

  const removeManualPart = (index) => {
    setManualParts(manualParts.filter((_, i) => i !== index))
  }

  // Labor charges functions
  const addLaborCharge = () => {
    setLaborCharges([...laborCharges, {
      sku: '',
      description: '',
      amount: 0
    }])
  }

  const updateLaborCharge = (index, field, value) => {
    const updated = [...laborCharges]
    updated[index][field] = value
    setLaborCharges(updated)
  }

  const removeLaborCharge = (index) => {
    setLaborCharges(laborCharges.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const partsTotal = manualParts.reduce((sum, part) => sum + (part.total || 0), 0)
    const laborTotal = laborCharges.reduce((sum, labor) => sum + (labor.amount || 0), 0)
    const subtotal = partsTotal + laborTotal
    const discountAmount = (subtotal * discount) / 100
    const total = subtotal - discountAmount
    
    return { partsTotal, laborTotal, subtotal, discountAmount, total }
  }

  const handleCreateButtonClick = () => {
    resetForm()
    setIsEditing(false)
    setEditingId(null)
    setViewMode('form')
  }

  const handleEditButtonClick = (quotation) => {
    // Populate form with quotation data
    setEditingId(quotation.id)
    setIsEditing(true)
    
    // Set Customer (Construct a minimal object since we have ID/Name)
    setSelectedCustomer({
      id: quotation.customerId,
      name: quotation.customerName,
      email: quotation.customerEmail,
      phone: quotation.customerPhone
    })
    
    setManualParts(quotation.partsOrdered || [])
    setLaborCharges(quotation.laborCharges || [])
    setWorkDescription(quotation.workDescription || '')
    setVehicleInfo(quotation.vehicleInfo || { make: '', model: '', year: '', plate: '' })
    setDiscount(quotation.discount || 0)
    setNotes(quotation.notes || '')
    setTerms(quotation.terms || 'Quote valid for 30 days. Prices subject to change.')
    
    // Calculate validity days
    const today = new Date()
    const validUntil = quotation.validUntil?.toDate ? quotation.validUntil.toDate() : new Date(quotation.validUntil)
    const diffTime = validUntil - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setValidityDays(diffDays > 0 ? diffDays : 30)
    
    setViewMode('form')
  }

  const handleSaveQuotation = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer')
      return
    }

    if (manualParts.length === 0 && laborCharges.length === 0) {
      alert('Please add at least one part or labor charge')
      return
    }

    setIsSaving(true)
    
    try {
      const totals = calculateTotals()
      const validUntilDate = new Date()
      validUntilDate.setDate(validUntilDate.getDate() + validityDays)
      
      const quotationData = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerEmail: selectedCustomer.email || '',
        customerPhone: selectedCustomer.phone || '',
        
        partsOrdered: manualParts.filter(p => p.partName),
        laborCharges: laborCharges.filter(l => l.description),
        
        workDescription,
        vehicleInfo,
        notes,
        terms,
        
        partsTotal: totals.partsTotal,
        laborTotal: totals.laborTotal,
        subtotal: totals.subtotal,
        discount,
        discountAmount: totals.discountAmount,
        total: totals.total,
        
        validUntil: validUntilDate,
        dateCreated: isEditing ? undefined : new Date(), // Don't update creation date on edit
        status: isEditing ? undefined : 'pending' // Preserve status on edit or set pending on create
      }
      
      // Remove undefined values
      Object.keys(quotationData).forEach(key => quotationData[key] === undefined && delete quotationData[key])

      if (isEditing && editingId) {
        await updateQuotation(editingId, quotationData)
        alert('Quotation updated successfully!')
      } else {
        await createQuotation(quotationData)
        alert('Quotation created successfully!')
      }
      
      resetForm()
      setViewMode('list')
      
    } catch (error) {
      console.error('Error saving quotation:', error)
      alert('Error saving quotation: ' + error.message)
    }
    
    setIsSaving(false)
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setManualParts([])
    setLaborCharges([])
    setWorkDescription('')
    setVehicleInfo({ make: '', model: '', year: '', plate: '' })
    setValidityDays(30)
    setDiscount(0)
    setNotes('')
    setTerms('Quote valid for 30 days. Prices subject to change.')
    setIsEditing(false)
    setEditingId(null)
  }

  const openViewModal = (quotation) => {
    setSelectedQuotationForView(quotation)
    setShowViewQuotationModal(true)
  }

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setShowCustomerModal(false)
    setCustomerSearchTerm('')
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase())
  )

  const getFilteredQuotations = () => {
    let filtered = quotationHistory
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(q => q.status === statusFilter)
    }
    
    if (searchQuery) {
      filtered = filtered.filter(q =>
        q.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.quotationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.workDescription?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return filtered
  }

  const downloadPDF = (quotation) => {
    try {
      const pdfData = {
        ...quotation,
        invoiceNumber: quotation.quotationNumber,
        isQuotation: true,
        type: 'quotation',
        documentTitle: 'QUOTATION',
        customerInfo: {
          name: quotation.customerName,
          email: quotation.customerEmail,
          phone: quotation.customerPhone
        },
        items: [
          ...(quotation.partsOrdered || []).map(part => ({
            kodProduk: part.sku,
            namaProduk: part.partName,
            quantity: part.quantity,
            finalPrice: part.pricePerUnit,
            totalPrice: part.total
          })),
          ...(quotation.laborCharges || []).map(labor => ({
            kodProduk: labor.sku || 'LABOR',
            namaProduk: labor.description,
            quantity: 1,
            finalPrice: labor.amount,
            totalPrice: labor.amount
          }))
        ],
        totalAmount: quotation.total,
        dateCreated: quotation.dateCreated || new Date(),
        validUntil: quotation.validUntil,
        terms: quotation.terms,
        notes: quotation.notes,
        workDescription: quotation.workDescription
      }
      
      PDFGenerator.downloadCustomerInvoicePDF(pdfData)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF')
    }
  }

  const totals = calculateTotals()

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Stats Cards Row */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* Total Card */}
           <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quotes</p>
                 <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</h3>
               </div>
               <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
               </div>
             </div>
           </div>

           {/* Pending Value Card */}
           <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Value</p>
                 <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.pendingValue)}</h3>
               </div>
               <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
               </div>
             </div>
             <p className="text-xs text-gray-500 mt-2">{stats.pendingCount} quotations pending</p>
           </div>

           {/* Accepted Card */}
           <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
             <div className="flex justify-between items-start">
               <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accepted</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.acceptedCount}</h3>
               </div>
               <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
               </div>
             </div>
           </div>

           {/* Action Card */}
           <div 
             onClick={handleCreateButtonClick}
             className="bg-blue-600 p-5 rounded-xl border border-blue-600 shadow-sm cursor-pointer hover:bg-blue-700 transition-colors flex flex-col justify-center items-center text-white"
           >
             <div className="p-3 bg-white/20 rounded-full mb-2">
               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
             </div>
             <h3 className="font-bold">Create New Quote</h3>
           </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          
          {/* Toolbar */}
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <h3 className="text-lg font-bold text-gray-900">Recent Quotations</h3>
             
             <div className="flex items-center gap-2 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                 <input
                   type="text"
                   placeholder="Search quotations..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                 />
                 <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
               </div>
               
               <select
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-400"
               >
                 <option value="all">All Status</option>
                 <option value="pending">Pending</option>
                 <option value="accepted">Accepted</option>
                 <option value="rejected">Rejected</option>
               </select>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Ref #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {getFilteredQuotations().length > 0 ? (
                  getFilteredQuotations().map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-medium text-gray-900">{quote.quotationNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-medium text-gray-900">{quote.customerName}</span>
                           <span className="text-xs text-gray-500">{quote.vehicleInfo?.make} {quote.vehicleInfo?.model}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-bold">
                        {formatCurrency(quote.total)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(quote.dateCreated)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStatusColor(quote.status)}`}>
                          {quote.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                           <button 
                             onClick={() => openViewModal(quote)}
                             className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                             title="View Details"
                           >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                             </svg>
                           </button>
                           <button 
                             onClick={() => handleEditButtonClick(quote)}
                             className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                             title="Edit"
                           >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                             </svg>
                           </button>
                           <button 
                             onClick={() => downloadPDF(quote)}
                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                             title="Download PDF"
                           >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <p className="font-medium">No quotations found</p>
                      <p className="text-sm mt-1">Create a new quotation to get started</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Quotation Form View */}
      {viewMode === 'form' && (
        <div className="max-w-5xl mx-auto space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Quotation' : 'New Quotation'}</h2>
              <button 
                onClick={() => setViewMode('list')}
                className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-1"
              >
                 Back to List
              </button>
           </div>

           {/* 1. Customer Selection Card */}
           <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">1. Customer Details</h3>
                {selectedCustomer && (
                  <button onClick={() => setSelectedCustomer(null)} className="text-sm text-blue-600 hover:underline">Change</button>
                )}
             </div>
             
             {selectedCustomer ? (
               <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                     </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{selectedCustomer.name}</h4>
                    <p className="text-sm text-gray-600">{selectedCustomer.phone}  {selectedCustomer.email}</p>
                  </div>
               </div>
             ) : (
               <button 
                 onClick={() => setShowCustomerModal(true)}
                 className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2"
               >
                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                 </svg>
                 <span className="font-medium">Select a Customer to Begin</span>
               </button>
             )}
           </div>

           {selectedCustomer && (
             <>
               {/* 2. Vehicle Information */}
               <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                 <h3 className="text-lg font-bold text-gray-900 mb-4">2. Vehicle Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Make</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        placeholder="e.g. Toyota"
                        value={vehicleInfo.make}
                        onChange={(e) => setVehicleInfo({...vehicleInfo, make: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Model</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        placeholder="e.g. Vios"
                        value={vehicleInfo.model}
                        onChange={(e) => setVehicleInfo({...vehicleInfo, model: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Year</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        placeholder="e.g. 2021"
                        value={vehicleInfo.year}
                        onChange={(e) => setVehicleInfo({...vehicleInfo, year: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">License Plate</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        placeholder="e.g. ABC 1234"
                        value={vehicleInfo.plate}
                        onChange={(e) => setVehicleInfo({...vehicleInfo, plate: e.target.value})}
                      />
                    </div>
                 </div>
                 
                 <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Work Description / Issues</label>
                    <textarea 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 h-20"
                      placeholder="Describe the requested work or reported issues..."
                      value={workDescription}
                      onChange={(e) => setWorkDescription(e.target.value)}
                    ></textarea>
                 </div>
               </div>

               {/* 3. Items & Charges */}
               <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-bold text-gray-900">3. Parts & Labor</h3>
                   <div className="flex gap-2">
                      <button onClick={addManualPart} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors">
                        + Add Part
                      </button>
                      <button onClick={addLaborCharge} className="px-3 py-1.5 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors">
                        + Add Labor
                      </button>
                   </div>
                 </div>

                 {/* Parts List */}
                 <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Parts</h4>
                    {manualParts.length > 0 ? (
                      <div className="space-y-2">
                        {manualParts.map((part, index) => (
                           <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 items-start">
                             <div className="col-span-2">
                               <input type="text" placeholder="SKU" className="w-full p-1.5 text-sm border rounded" value={part.sku} onChange={(e) => updateManualPart(index, 'sku', e.target.value)} />
                             </div>
                             <div className="col-span-5">
                               <input type="text" placeholder="Item Name" className="w-full p-1.5 text-sm border rounded" value={part.partName} onChange={(e) => updateManualPart(index, 'partName', e.target.value)} />
                             </div>
                             <div className="col-span-1">
                               <input type="number" placeholder="Qty" className="w-full p-1.5 text-sm border rounded" value={part.quantity} onChange={(e) => updateManualPart(index, 'quantity', parseFloat(e.target.value) || 0)} />
                             </div>
                             <div className="col-span-2">
                               <input type="number" placeholder="Price" className="w-full p-1.5 text-sm border rounded" value={part.pricePerUnit} onChange={(e) => updateManualPart(index, 'pricePerUnit', parseFloat(e.target.value) || 0)} />
                             </div>
                             <div className="col-span-1 text-right font-medium text-sm pt-2">
                               {formatCurrency(part.total)}
                             </div>
                             <div className="col-span-1 flex justify-end">
                               <button onClick={() => removeManualPart(index)} className="text-gray-400 hover:text-red-500">
                                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                             </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
                        No parts added
                      </div>
                    )}
                 </div>

                 {/* Labor List */}
                 <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Labor Charges</h4>
                    {laborCharges.length > 0 ? (
                      <div className="space-y-2">
                        {laborCharges.map((labor, index) => (
                           <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-green-50 rounded-lg border border-green-100 items-start">
                             <div className="col-span-2">
                               <input type="text" placeholder="Code" className="w-full p-1.5 text-sm border rounded" value={labor.sku} onChange={(e) => updateLaborCharge(index, 'sku', e.target.value)} />
                             </div>
                             <div className="col-span-6">
                               <input type="text" placeholder="Description" className="w-full p-1.5 text-sm border rounded" value={labor.description} onChange={(e) => updateLaborCharge(index, 'description', e.target.value)} />
                             </div>
                             <div className="col-span-2">
                               <input type="number" placeholder="Cost" className="w-full p-1.5 text-sm border rounded" value={labor.amount} onChange={(e) => updateLaborCharge(index, 'amount', parseFloat(e.target.value) || 0)} />
                             </div>
                             <div className="col-span-1 text-right font-medium text-sm pt-2">
                               {formatCurrency(labor.amount)}
                             </div>
                             <div className="col-span-1 flex justify-end">
                               <button onClick={() => removeLaborCharge(index)} className="text-gray-400 hover:text-red-500">
                                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                             </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
                        No labor charges added
                      </div>
                    )}
                 </div>
               </div>

               {/* 4. Terms & Summary */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Left Column: Terms */}
                 <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-4">Terms & Notes</h4>
                    <div className="space-y-4">
                       <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Validity Period (Days)</label>
                         <input type="number" value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)} className="w-full p-2 border rounded-lg text-sm" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Customer Notes (Visible on PDF)</label>
                         <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded-lg text-sm h-16"></textarea>
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Terms & Conditions</label>
                         <textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="w-full p-2 border rounded-lg text-sm h-16"></textarea>
                       </div>
                    </div>
                 </div>

                 {/* Right Column: Totals */}
                 <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
                    <div className="space-y-3">
                       <div className="flex justify-between text-gray-600">
                         <span>Parts Total</span>
                         <span>{formatCurrency(totals.partsTotal)}</span>
                       </div>
                       <div className="flex justify-between text-gray-600">
                         <span>Labor Total</span>
                         <span>{formatCurrency(totals.laborTotal)}</span>
                       </div>
                       <div className="flex justify-between font-medium text-gray-900 pt-2 border-t border-dashed">
                         <span>Subtotal</span>
                         <span>{formatCurrency(totals.subtotal)}</span>
                       </div>
                       <div className="flex justify-between items-center text-green-600">
                         <div className="flex items-center gap-2">
                           <span>Discount</span>
                           <input 
                             type="number" 
                             className="w-16 p-1 text-xs border border-green-200 rounded text-center bg-green-50"
                             value={discount}
                             onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                           />
                           <span>%</span>
                         </div>
                         <span>- {formatCurrency(totals.discountAmount)}</span>
                       </div>
                       <div className="flex justify-between text-2xl font-bold text-blue-600 pt-4 border-t border-gray-100">
                         <span>Grand Total</span>
                         <span>{formatCurrency(totals.total)}</span>
                       </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button onClick={() => setViewMode('list')} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveQuotation} 
                        disabled={isSaving}
                        className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : (isEditing ? 'Update Quotation' : 'Create Quotation')}
                      </button>
                    </div>
                 </div>
               </div>
             </>
           )}
        </div>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-900">Select Customer</h3>
                <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             <div className="p-4">
               <input 
                 type="text" 
                 placeholder="Search customer name or phone..." 
                 className="w-full px-4 py-2 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-blue-100"
                 value={customerSearchTerm}
                 onChange={(e) => setCustomerSearchTerm(e.target.value)}
               />
               <div className="max-h-60 overflow-y-auto space-y-2">
                 {filteredCustomers.map(cust => (
                   <div 
                     key={cust.id} 
                     onClick={() => selectCustomer(cust)}
                     className="p-3 border border-gray-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all"
                   >
                     <p className="font-bold text-gray-900">{cust.name}</p>
                     <p className="text-sm text-gray-500">{cust.phone}</p>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        </div>
      )}

      {/* View Modal (Digital Invoice Preview) */}
      {showViewQuotationModal && selectedQuotationForView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
               <div>
                  <h3 className="text-xl font-bold text-gray-900">Quotation #{selectedQuotationForView.quotationNumber}</h3>
                  <p className="text-sm text-gray-500">{formatDate(selectedQuotationForView.dateCreated)}</p>
               </div>
               <button onClick={() => setShowViewQuotationModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
            </div>
            
            <div className="p-8">
              {/* Recipient Info */}
              <div className="flex justify-between mb-8">
                 <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Quoted For</h4>
                    <p className="font-bold text-lg text-gray-900">{selectedQuotationForView.customerName}</p>
                    <p className="text-gray-600">{selectedQuotationForView.customerEmail}</p>
                    <p className="text-gray-600">{selectedQuotationForView.customerPhone}</p>
                 </div>
                 <div className="text-right">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Vehicle</h4>
                    <p className="font-bold text-gray-900">{selectedQuotationForView.vehicleInfo?.make} {selectedQuotationForView.vehicleInfo?.model}</p>
                    <p className="text-gray-600">{selectedQuotationForView.vehicleInfo?.plate}</p>
                 </div>
              </div>

              {/* Items Table */}
              <table className="w-full mb-8">
                 <thead className="border-b-2 border-gray-100">
                    <tr>
                       <th className="text-left py-3 font-bold text-gray-600">Item Description</th>
                       <th className="text-center py-3 font-bold text-gray-600">Qty</th>
                       <th className="text-right py-3 font-bold text-gray-600">Amount</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {/* Parts */}
                    {selectedQuotationForView.partsOrdered?.map((part, i) => (
                       <tr key={`p-${i}`}>
                          <td className="py-3">
                             <p className="font-medium text-gray-900">{part.partName}</p>
                             <p className="text-xs text-gray-500">{part.sku}</p>
                          </td>
                          <td className="text-center py-3 text-gray-600">{part.quantity}</td>
                          <td className="text-right py-3 text-gray-900 font-medium">{formatCurrency(part.total)}</td>
                       </tr>
                    ))}
                    {/* Labor */}
                    {selectedQuotationForView.laborCharges?.map((labor, i) => (
                       <tr key={`l-${i}`}>
                          <td className="py-3">
                             <p className="font-medium text-gray-900">{labor.description}</p>
                             <p className="text-xs text-green-600 font-medium">Labor Charge</p>
                          </td>
                          <td className="text-center py-3 text-gray-600">1</td>
                          <td className="text-right py-3 text-gray-900 font-medium">{formatCurrency(labor.amount)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                 <div className="w-64 space-y-2">
                    <div className="flex justify-between text-gray-600">
                       <span>Subtotal</span>
                       <span>{formatCurrency(selectedQuotationForView.subtotal)}</span>
                    </div>
                    {selectedQuotationForView.discount > 0 && (
                       <div className="flex justify-between text-green-600">
                          <span>Discount ({selectedQuotationForView.discount}%)</span>
                          <span>-{formatCurrency(selectedQuotationForView.discountAmount)}</span>
                       </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-blue-800 pt-4 border-t border-gray-200">
                       <span>Total</span>
                       <span>{formatCurrency(selectedQuotationForView.total)}</span>
                    </div>
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                 <button onClick={() => downloadPDF(selectedQuotationForView)} className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-md">
                    Download PDF Invoice
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default QuotationCreation
