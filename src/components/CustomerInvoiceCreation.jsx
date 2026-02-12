import React, { useState, useEffect } from 'react'
import { useCustomer } from '../context/CustomerContext'
import { useEmployee } from '../context/EmployeeContext'
import { createCustomerInvoice, updateCustomerInvoice } from '../utils/FirebaseDataUtils'
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { LeanxService } from '../utils/LeanxService'
import InvoicePreview from './InvoicePreview'

function CustomerInvoiceCreation({ setActiveSection }) {
  // --- States ---
  const [viewMode, setViewMode] = useState('list') // 'list', 'form', 'analysis'
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Modal & Search
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [showPDF, setShowPDF] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [paymentLinkModal, setPaymentLinkModal] = useState({ show: false, url: '', invoice: null, loading: false, error: null })
  const [analysisSearch, setAnalysisSearch] = useState('')

  // Form Data
  const [manualParts, setManualParts] = useState([])
  const [laborCharges, setLaborCharges] = useState([])
  const [workDescription, setWorkDescription] = useState('')
  const [vehicleInfo, setVehicleInfo] = useState({ make: '', model: '', year: '', plate: '' })
  const [paymentTerms, setPaymentTerms] = useState(30)
  const [paymentStatus, setPaymentStatus] = useState('pending')
  const [discount, setDiscount] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [depositStatus, setDepositStatus] = useState('none') // 'none', 'paid_offline', 'link_generated', 'paid_link'
  const [notes, setNotes] = useState('')
  
  // Job Return / Linking
  const [parentInvoiceId, setParentInvoiceId] = useState(null)
  const [parentInvoiceNumber, setParentInvoiceNumber] = useState(null)

  // Financials & Commission
  const [useDirectLending, setUseDirectLending] = useState(false)
  const [directLendingAmount, setDirectLendingAmount] = useState(0)
  const [totalPartsSupplierCost, setTotalPartsSupplierCost] = useState(0)
  
  // Commission 2.0 (Flexible Multi-Person)
  const [mechanics, setMechanics] = useState([]) // [{ id, name, commissionType: 'percentage'|'fixed', commissionValue, commissionAmount }]
  const [requestDepositAmount, setRequestDepositAmount] = useState(0)

  // Data
  const [invoiceHistory, setInvoiceHistory] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { customers = [] } = useCustomer() || {}
  const { employees = [] } = useEmployee() || {}

  // Payment Callback Handler
  useEffect(() => {
     const params = new URLSearchParams(window.location.search)
     const status = params.get('payment_status')
     const invoiceNum = params.get('invoice')
     const amountStr = params.get('amount')
     
     if (status === 'success' && invoiceNum && invoiceHistory.length > 0) {
        const targetInvoice = invoiceHistory.find(i => i.invoiceNumber === invoiceNum)
        
        if (targetInvoice) {
           const amountPaid = parseFloat(amountStr || targetInvoice.balanceDue || 0)

           // Update DB if not already paid (check balance > 1 to allow for float rounding)
           if (targetInvoice.depositStatus !== 'paid_link' && targetInvoice.balanceDue > 1) {
               
               const confirmUpdate = async () => {
                   try {
                      const newDeposit = (targetInvoice.deposit || 0) + amountPaid
                      const newBalance = targetInvoice.customerTotal - newDeposit
                      
                      await updateCustomerInvoice(targetInvoice.id, {
                          depositStatus: 'paid_link',
                          deposit: newDeposit,
                          balanceDue: newBalance,
                          paymentStatus: newBalance < 1 ? 'paid' : 'deposit-paid',
                          paymentMethod: 'online_link'
                      })
                      alert(`Success! Payment of RM${amountPaid} verified and recorded.`)
                      // Open view for receipt
                      setViewInvoice(targetInvoice) 
                   } catch(e) {
                       console.error(e)
                       alert("Payment verified but update failed. Check console.")
                   }
               }
               confirmUpdate()

           } else {
               // Already recorded
               if(targetInvoice.balanceDue <= 1) {
                  alert(`Payment for Invoice #${invoiceNum} verified.`)
                  setViewInvoice(targetInvoice)
               }
           }

           // Clear URL params cleanly so we don't re-trigger
           window.history.replaceState({}, document.title, window.location.pathname)
        }
     }
  }, [invoiceHistory])

  useEffect(() => {
    const q = query(collection(db, 'customer_invoices'), orderBy('dateCreated', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setInvoiceHistory(snap.docs.map(d => ({ 
        id: d.id, ...d.data(), 
        dateCreated: d.data().dateCreated?.toDate() || new Date() 
      })))
    })
    return () => unsub()
  }, [])

  // --- Calculations (Robust - all values forced to float) ---
  const calculateTotals = () => {
    // Recalculate each part's total from qty * price to prevent stale .total values
    const partsTotal = manualParts.reduce((s, p) => {
       const qty = parseFloat(p.quantity) || 0
       const price = parseFloat(p.pricePerUnit) || 0
       const lineTotal = Math.round(qty * price * 100) / 100 // Prevent floating point drift
       return s + lineTotal
    }, 0)
    const laborTotal = laborCharges.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
    const subtotal = Math.round((partsTotal + laborTotal) * 100) / 100
    const discountAmount = Math.round((subtotal * (parseFloat(discount) || 0)) / 100 * 100) / 100
    const total = Math.round((subtotal - discountAmount) * 100) / 100
    const depositAmount = parseFloat(deposit) || 0
    const balanceDue = Math.round((total - depositAmount) * 100) / 100
    const directLending = useDirectLending ? parseFloat(directLendingAmount) || 0 : 0
    const customerPayableAmount = useDirectLending ? balanceDue - directLending : balanceDue
    
    // Profit Calc
    const costOfParts = Number(totalPartsSupplierCost) || 0
    const baseForCommission = subtotal 
    
    let totalCommission = 0
    const calculatedMechanics = mechanics.map(m => {
       const amt = m.commissionType === 'percentage' 
          ? (baseForCommission * (Number(m.commissionValue)||0)) / 100
          : (Number(m.commissionValue) || 0)
       totalCommission += amt
       return { ...m, commissionAmount: amt }
    })

    return { 
       partsTotal, laborTotal, subtotal, discountAmount, total, 
       deposit: depositAmount, balanceDue, directLendingAmount: directLending, 
       customerPayableAmount, partsSupplierCost: costOfParts, 
       commission: totalCommission, calculatedMechanics 
    }
  }

  // --- Actions ---
  const handleReturnJob = (invoice) => {
     resetForm()
     setSelectedCustomer({
        id: invoice.customerId,
        name: invoice.customerName,
        phone: invoice.customerPhone,
        email: invoice.customerEmail
     })
     setParentInvoiceId(invoice.id)
     setParentInvoiceNumber(invoice.invoiceNumber)
     setVehicleInfo(invoice.vehicleInfo || { make: '', model: '', year: '', plate: '' })
     setWorkDescription(`Return Job / Warranty Claim for Invoice #${invoice.invoiceNumber}`)
     setViewMode('form')
  }

  const handleSaveInvoice = async () => {
    if (!selectedCustomer) return alert('Select Customer')
    if (manualParts.length === 0 && laborCharges.length === 0) return alert('Add items')
    
    // Helper to recursively remove undefined (Firebase safety)
    const sanitize = (obj) => {
        if (obj === undefined) return null;
        if (obj === null) return null;
        if (typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj;
        if (Array.isArray(obj)) return obj.map(sanitize);
        const newObj = {};
        Object.keys(obj).forEach(key => {
            const val = sanitize(obj[key]);
            if (val !== undefined) newObj[key] = val;
            else newObj[key] = null;
        });
        return newObj;
    };

    setIsSaving(true)
    try {
       const t = calculateTotals()
       const rawData = {
          customerId: selectedCustomer.id || null,
          customerName: selectedCustomer.name || 'Unknown',
          customerPhone: selectedCustomer.phone || '',
          customerEmail: selectedCustomer.email || '',
          workDescription: workDescription || '',
          vehicleInfo: vehicleInfo || { make: '', model: '', year: '', plate: '' },
          partsOrdered: manualParts || [],
          laborCharges: laborCharges || [],
          // money
          partsTotal: Number(t.partsTotal) || 0,
          laborTotal: Number(t.laborTotal) || 0,
          subtotal: Number(t.subtotal) || 0,
          discount: Number(discount) || 0,
          discountAmount: Number(t.discountAmount) || 0,
          deposit: Number(t.deposit) || 0,
          depositStatus: t.deposit > 0 ? 'paid_offline' : (requestDepositAmount > 0 ? 'link_generated' : 'none'),
          balanceDue: Number(t.balanceDue) || 0,
          total: Number(t.total) || 0,
          customerTotal: Number(t.total) || 0,
          customerPayableAmount: Number(t.customerPayableAmount) || 0,
          useDirectLending: !!useDirectLending,
          directLendingAmount: Number(t.directLendingAmount) || 0,
          paymentStatus: paymentStatus || 'pending',
          paymentTerms: Number(paymentTerms) || 0,
          notes: notes || '',
          // internal
          partsSupplierCost: Number(t.partsSupplierCost) || 0,
          mechanics: t.calculatedMechanics || [],
          commissionAmount: Number(t.commission) || 0,
          // linking
          parentInvoiceId: parentInvoiceId || null,
          parentInvoiceNumber: parentInvoiceNumber || null,
          invoiceType: parentInvoiceId ? 'return_job' : 'standard'
       }
       
       const data = sanitize(rawData); // Clean up any lingering undefined values

       if (isEditing && editingId) {
          await updateCustomerInvoice(editingId, data)
          alert('Updated!')
       } else {
          data.dateCreated = new Date()
          data.dueDate = new Date(Date.now() + paymentTerms * 86400000)
          const res = await createCustomerInvoice(data)
          alert('Created!')
          if (requestDepositAmount > 0) {
              setPaymentLinkModal({ show: true, amount: requestDepositAmount, invoice: { ...data, id: res.id, invoiceNumber: res.invoiceNumber || 'NEW' } })
          }
       }
       resetForm()
       setViewMode('list')
    } catch (e) {
       console.error(e)
       alert('Error: ' + e.message)
    } finally {
       setIsSaving(false)
    }
  }
  
  const resetForm = () => {
     setSelectedCustomer(null)
     setManualParts([])
     setLaborCharges([])
     setWorkDescription('')
     setVehicleInfo({ make: '', model: '', year: '', plate: '' })
     setPaymentStatus('pending')
     setDiscount(0)
     setDeposit(0)
     setDepositStatus('none')
     setIsEditing(false)
     setEditingId(null)
     setTotalPartsSupplierCost(0)
     setMechanics([])
     setNotes('')
     setParentInvoiceId(null)
     setParentInvoiceNumber(null)
     setRequestDepositAmount(0)
  }

  const handleDelete = async (id) => {
     if (window.confirm("Delete?")) await deleteDoc(doc(db, 'customer_invoices', id))
  }

  // --- Payment Link ---
  const handleLink = (inv) => {
     if (inv.paymentStatus === 'paid' && inv.balanceDue <= 0) {
         alert("This invoice is already fully paid.")
         return
     }
     
     // EXTENSIVE ANALYSIS: Current Balance vs Saved Link
     // 1. Calculate what we NEED to charge now (Current Balance)
     const currentBalance = inv.balanceDue > 0 ? inv.balanceDue : (inv.total || inv.customerTotal)
     
     // 2. Check if we have an existing link
     let existingUrl = inv.lastPaymentLink 
     let showUrl = null

     // 3. Auto-Detection Logic
     if (existingUrl) {
         // Scenario A: Deposit Phase
         // If we are still waiting for a deposit, the saved link is likely the deposit link. Use it.
         if (inv.depositStatus === 'link_generated' || inv.depositStatus === 'pending') {
             showUrl = existingUrl
         }
         // Scenario B: Full Payment Phase (No Deposit)
         // If there is no deposit scheme and it's unpaid, use the saved link.
         else if ((!inv.deposit || inv.deposit === 0) && inv.paymentStatus !== 'paid') {
             showUrl = existingUrl
         }
         // Scenario C: Balance Phase (Deposit Paid, Balance Remains)
         // If deposit is marked paid, the old link is likely the "Deposit Link" (which is now done).
         // We should NOT show it by default. We want to prompt for a NEW link for the balance.
         else if ((inv.depositStatus === 'paid_link' || inv.depositStatus === 'paid_offline') && inv.balanceDue > 1) {
             showUrl = null // Force "Generate New Link" view
         }
         // Scenario D: Fallback
         else {
             showUrl = existingUrl
         }
     }
     
     setPaymentLinkModal({ 
         show: true, 
         amount: currentBalance, 
         invoice: inv, 
         url: showUrl,
         isBalanceLink: inv.depositStatus?.includes('paid')
     })
  }
  
  const generateLink = async () => {
     const { invoice, amount } = paymentLinkModal
     try {
       setPaymentLinkModal(p => ({...p, loading: true, error: null}))
       // Try real service
       const res = await LeanxService.generatePaymentLink(invoice, { name: invoice.customerName, phone: invoice.customerPhone }, amount)
       if (res.success) {
          setPaymentLinkModal(p => ({...p, url: res.url, loading: false}))
          
          // Save the generated link to Firestore so it can be used for "Retry Payment" later
          try {
             await updateCustomerInvoice(invoice.id, { 
                 lastPaymentLink: res.url,
                 lastPaymentId: res.id || null // Save the Bill ID for API verification
             })
          } catch(err) { console.warn("Could not save payment link to DB", err) }

          // If this was for deposit, update status
          if (invoice.deposit < amount && invoice.balanceDue > 0) {
             // It might be a deposit link
             // In a real app, we'd wait for webhook. Here we mark 'link_generated'.
          }
       } else {
          throw new Error(res.error || 'Failed')
       }
     } catch (e) {
        // Validation / Demo Fallback
        const demo = `https://demo.payment.com/pay/${invoice.invoiceNumber}?amt=${amount}`
        setPaymentLinkModal(p => ({...p, url: demo, loading: false, error: 'Demo Link Generated (API Failed)'}))
     }
  }
  
  const confirmDepositPaid = async (invoice) => {
     if(window.confirm(`Confirm deposit of RM${requestDepositAmount > 0 ? requestDepositAmount : invoice.deposit} received via link?`)) {
        await updateCustomerInvoice(invoice.id, { 
            depositStatus: 'paid_link', 
            deposit: (invoice.deposit || 0) + (requestDepositAmount > 0 ? Number(requestDepositAmount) : 0),
            balanceDue: invoice.customerTotal - ((invoice.deposit || 0) + (requestDepositAmount > 0 ? Number(requestDepositAmount) : 0))
        })
     }
  }

  // --- Analysis Helpers ---
  const getAnalysis = () => {
     let rev = 0, cost = 0, profit = 0
     const items = invoiceHistory.map(i => {
        const r = Number(i.customerTotal || i.total || 0)
        const c = (Number(i.partsSupplierCost)||0) + (Number(i.commissionAmount)||0)
        const p = r - c
        rev += r; cost += c; profit += p
        return { ...i, calculatedProfit: p, calculatedCost: c }
     })
     return { rev, cost, profit, margin: rev ? (profit/rev)*100 : 0, items }
  }
  const analysis = getAnalysis()
  const totals = calculateTotals()

  // --- Render Helpers ---
  const formatCurrency = (v) => new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(v || 0)

  // Mechanic Mgmt
  const addMechanic = (e) => {
     const emp = employees.find(em => em.id === e.target.value)
     if(emp && !mechanics.find(m => m.id === emp.id)) {
        // Fix for mechanics not having 'name' property but 'firstName/lastName'
        const empName = emp.name || (emp.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : 'Unnamed Staff')
        setMechanics([...mechanics, { id: emp.id, name: empName, commissionType: 'percentage', commissionValue: 0 }])
     }
  }
  
  return (
    <div className="space-y-6">
       
       {/* Stats (List Mode) */}
       {viewMode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 font-bold text-xs uppercase">Total Invoices</p>
                <h3 className="text-2xl font-bold mt-1">{invoiceHistory.length}</h3>
             </div>
             <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 font-bold text-xs uppercase">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(analysis.rev)}</h3>
             </div>
             <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 font-bold text-xs uppercase">Total Profit</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-600">{formatCurrency(analysis.profit)}</h3>
                <p className="text-xs text-gray-400 mt-1">Margin: {analysis.margin.toFixed(1)}%</p>
             </div>
             <div className="flex flex-col gap-2">
                <button onClick={() => { resetForm(); setViewMode('form') }} className="flex-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">New Invoice</button>
                <button onClick={() => setViewMode('analysis')} className="py-2 bg-white border border-gray-200 font-medium rounded-lg hover:bg-gray-50">Detailed Analysis</button>
             </div>
          </div>
       )}

       {/* List View */}
       {viewMode === 'list' && (
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
             <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Invoice History</h3>
                <input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="p-2 border rounded text-sm w-64" />
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                   <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                         <th className="px-4 py-3">Ref #</th>
                         <th className="px-4 py-3">Customer</th>
                         <th className="px-4 py-3">Mechanic</th>
                         <th className="px-4 py-3">Amount</th>
                         <th className="px-4 py-3">Deposit</th>
                         <th className="px-4 py-3">Status</th>
                         <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {invoiceHistory.filter(i => !searchQuery || i.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || i.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())).map(i => (
                         <tr key={i.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono">{i.invoiceNumber} 
                               {i.parentInvoiceNumber && <span className="block text-[10px] text-purple-500">Ret: #{i.parentInvoiceNumber}</span>}
                            </td>
                            <td className="px-4 py-3">{i.customerName}</td>
                            <td className="px-4 py-3 text-xs">
                               {(i.mechanics || []).map(m => <div key={m.id}>{(m.name || '').split(' ')[0]}</div>)}
                            </td>
                            <td className="px-4 py-3 font-bold">{formatCurrency(i.total || i.customerTotal)}</td>
                            <td className="px-4 py-3">
                               {i.deposit > 0 ? (
                                   <span className="text-green-600 font-bold text-xs flex flex-col">
                                       <span>Paid {formatCurrency(i.deposit)}</span>
                                       {/* Allow paying remaining balance via link even if deposit paid */}
                                       {i.balanceDue > 1 && (
                                            <button 
                                                onClick={() => setPaymentLinkModal({ show: true, amount: i.balanceDue, invoice: i })}
                                                className="text-[10px] text-blue-600 underline mt-1 hover:text-blue-800 text-left"
                                            >
                                                Send Balance Link
                                            </button>
                                       )}
                                   </span>
                               ) : i.depositStatus === 'link_generated' ? (
                                   <button 
                                     onClick={() => {
                                         const amt = prompt("Enter deposit amount received (RM):", i.total * 0.1); 
                                         if (amt && !isNaN(amt)) {
                                            updateCustomerInvoice(i.id, {
                                                depositStatus: 'paid_link',
                                                deposit: Number(amt),
                                                balanceDue: (i.customerTotal || i.total) - Number(amt)
                                            })
                                         }
                                     }}
                                     className="bg-orange-100 text-orange-700 font-bold text-xs px-2 py-1 rounded hover:bg-orange-200 border border-orange-200 cursor-pointer flex items-center gap-1"
                                     title="Click to mark as Paid"
                                   >
                                     Link Sent (Mark Paid)
                                   </button>
                               ) : (
                                   <span className="text-gray-400 text-xs">-</span>
                               )}
                            </td>
                            <td className="px-4 py-3">
                               <span className={`px-2 py-1 rounded text-xs font-bold border ${i.paymentStatus==='paid'?'bg-green-50 text-green-700 border-green-200':'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                  {i.paymentStatus === 'paid' ? 'Full Payment' : 'Pending/Partial'}
                               </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                               <button onClick={() => setViewInvoice(i)} className="text-gray-600 hover:underline">View</button>
                               <button onClick={() => { setIsEditing(true); setEditingId(i.id); setSelectedCustomer({id:i.customerId,name:i.customerName,phone:i.customerPhone,email:i.customerEmail}); setManualParts(i.partsOrdered||[]); setLaborCharges(i.laborCharges||[]); setPaymentStatus(i.paymentStatus); setMechanics(i.mechanics||[]); setDeposit(i.deposit||0); setTotalPartsSupplierCost(i.partsSupplierCost||0); setDiscount(i.discount||0); setWorkDescription(i.workDescription||''); setVehicleInfo(i.vehicleInfo||{make:'',model:'',year:'',plate:''}); setNotes(i.notes||''); setUseDirectLending(!!i.useDirectLending); setDirectLendingAmount(i.directLendingAmount||0); setViewMode('form'); }} className="text-blue-600 hover:underline">Edit</button>
                               <button onClick={() => handleLink(i)} className="text-green-600 hover:underline">Link</button>
                               <button onClick={() => handleReturnJob(i)} className="text-purple-600 hover:underline">Return</button> 
                               <button onClick={() => handleDelete(i.id)} className="text-red-600 hover:underline">Del</button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       )}

       {/* Form View (Editor) */}
       {viewMode === 'form' && (
          <div className="space-y-4 max-w-4xl mx-auto bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div>
                   <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Invoice' : parentInvoiceId ? 'New Return Job' : 'New Invoice'}</h2>
                   {parentInvoiceId && <p className="text-sm text-purple-600 font-bold">Linked to Invoice #{parentInvoiceNumber}</p>}
                </div>
                <button onClick={() => setViewMode('list')} className="text-gray-500">Cancel</button>
             </div>
             
             {/* Customer */}
             <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer</label>
                {selectedCustomer ? (
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded flex justify-between items-center">
                      <div>
                         <span className="font-bold text-blue-900">{selectedCustomer.name}</span>
                         {selectedCustomer.phone && <span className="ml-3 text-sm text-blue-700">({selectedCustomer.phone})</span>}
                      </div>
                      <button onClick={() => setSelectedCustomer(null)} className="text-xs text-blue-600 underline">Change</button>
                   </div>
                ) : (
                   <button onClick={() => setShowCustomerModal(true)} className="w-full p-4 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:bg-gray-50 font-bold">+ Select Customer</button>
                )}
             </div>
             
             {/* Vehicle & Work */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle</label>
                    <input placeholder="Make/Model/Plate" className="input-std" value={vehicleInfo.model} onChange={e => setVehicleInfo({...vehicleInfo, model: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                    <input placeholder="Work Description" className="input-std" value={workDescription} onChange={e => setWorkDescription(e.target.value)} />
                 </div>
             </div>

             {/* Line Items */}
             <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <h3 className="font-bold text-gray-800">Parts & Labor</h3>
                   <div className="space-x-2">
                      <button onClick={() => setManualParts([...manualParts, {sku:'',partName:'',quantity:1,pricePerUnit:0,total:0}])} className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">+ Part</button>
                      <button onClick={() => setLaborCharges([...laborCharges, {description:'',amount:0}])} className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">+ Labor</button>
                   </div>
                </div>
                {manualParts.map((p, i) => (
                   <div key={i} className="flex gap-2">
                       <input className="input-sm w-24" placeholder="SKU" value={p.sku} onChange={e => { const u=[...manualParts]; u[i].sku=e.target.value; setManualParts(u)}} />
                       <input className="input-sm flex-1" placeholder="Part Name" value={p.partName} onChange={e => { const u=[...manualParts]; u[i].partName=e.target.value; setManualParts(u)}} />
                       <input className="input-sm w-16" type="number" value={p.quantity} onChange={e => { const u=[...manualParts]; u[i].quantity=parseFloat(e.target.value)||0; u[i].total=Math.round(u[i].quantity*u[i].pricePerUnit*100)/100; setManualParts(u)}} />
                       <input className="input-sm w-24" type="number" value={p.pricePerUnit} onChange={e => { const u=[...manualParts]; u[i].pricePerUnit=parseFloat(e.target.value)||0; u[i].total=Math.round(u[i].quantity*u[i].pricePerUnit*100)/100; setManualParts(u)}} />
                       <button onClick={() => setManualParts(manualParts.filter((_,x) => x!==i))} className="text-red-500 font-bold">x</button>
                   </div>
                ))}
                {laborCharges.map((l, i) => (
                   <div key={i} className="flex gap-2">
                       <input className="input-sm flex-1" placeholder="Labor Description" value={l.description} onChange={e => { const u=[...laborCharges]; u[i].description=e.target.value; setLaborCharges(u)}} />
                       <input className="input-sm w-24" type="number" value={l.amount} onChange={e => { const u=[...laborCharges]; u[i].amount=parseFloat(e.target.value)||0; setLaborCharges(u)}} />
                       <button onClick={() => setLaborCharges(laborCharges.filter((_,x) => x!==i))} className="text-red-500 font-bold">x</button>
                   </div>
                ))}
             </div>
             
             {/* Financials & Deposits */}
             <div className="bg-blue-50 p-4 rounded border border-blue-200 mt-4">
                <h4 className="font-bold text-xs uppercase text-blue-800 mb-2">Payment & Deposit</h4>
                <div className="flex flex-wrap gap-4 items-end">
                   <div>
                      <label className="block text-xs font-bold text-gray-500">Deposit Paid (Offline)</label>
                      <input type="number" className="input-sm bg-white" value={deposit} onChange={e => setDeposit(e.target.value)} />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500">Request Deposit (Link)</label>
                      <input type="number" className="input-sm bg-white" value={requestDepositAmount} onChange={e => setRequestDepositAmount(e.target.value)} placeholder="0.00" />
                   </div>
                   <div className="text-right flex-1">
                      <p className="text-xs text-gray-500">Balance Due</p>
                      <p className="font-bold text-xl text-blue-900">{formatCurrency(totals.balanceDue)}</p>
                   </div>
                </div>
                {requestDepositAmount > 0 && <p className="text-xs text-blue-600 mt-2 font-medium">? Status will be "Pending Link Payment". You must confirm receipt to mark as Paid.</p>}
             </div>

             {/* Internal Costing (Mechanics & Supplier) */}
             <div className="bg-yellow-50 p-4 rounded border border-yellow-200 mt-6">
                <h4 className="font-bold text-xs uppercase text-yellow-800 mb-2">Internal Costing & Commission</h4>
                <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Supplier Part Costs</label>
                      <input type="number" className="input-sm bg-white" value={totalPartsSupplierCost} onChange={e => setTotalPartsSupplierCost(e.target.value)} />
                   </div>
                   
                   <div className="border-t border-yellow-200 pt-3">
                      <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-gray-500">Mechanic Commission</label>
                          <select className="text-xs p-1 rounded border text-gray-900 bg-white w-full max-w-xs" onChange={addMechanic} value="">
                             <option value="">+ Add Mechanic</option>
                             {employees.length > 0 ? employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name || (e.firstName ? `${e.firstName} ${e.lastName || ''}`.trim() : 'Unnamed Staff')}</option>
                             )) : <option disabled>No staff found</option>}
                          </select>
                      </div>
                      {mechanics.length === 0 && <p className="text-xs text-gray-400 italic">No mechanics assigned.</p>}
                      {mechanics.map((m, idx) => (
                         <div key={idx} className="flex gap-2 items-center mb-2 bg-white p-2 rounded border border-yellow-100">
                             <span className="text-xs font-bold w-32 truncate">{m.name}</span>
                             <select className="text-xs p-1 border rounded" value={m.commissionType} onChange={e => { const n=[...mechanics]; n[idx].commissionType=e.target.value; setMechanics(n) }}>
                                <option value="percentage">%</option>
                                <option value="fixed">RM</option>
                             </select>
                             <input type="number" className="input-sm w-20" value={m.commissionValue} onChange={e => { const n=[...mechanics]; n[idx].commissionValue=e.target.value; setMechanics(n) }} />
                             <span className="text-xs text-gray-500 font-mono w-20 text-right">{formatCurrency(totals.calculatedMechanics[idx]?.commissionAmount)}</span>
                             <button onClick={() => setMechanics(mechanics.filter((_,x) => x!==idx))} className="text-red-500 font-bold ml-auto">x</button>
                         </div>
                      ))}
                      <div className="text-right text-xs text-gray-500 mt-2">
                         Total Commission: <b>{formatCurrency(totals.commission)}</b>
                      </div>
                   </div>
                </div>
                <div className="mt-2 text-right text-xs text-gray-500 border-t border-yellow-200 pt-2">
                   Est. Net Profit: <b className="text-green-700 text-sm">{formatCurrency(totals.total - (Number(totalPartsSupplierCost)||0) - totals.commission)}</b>
                </div>
             </div>
             
             {/* Footer Actions */}
             <div className="flex justify-between items-center pt-4 border-t mt-6">
                 <div>
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.total)}</p>
                 </div>
                 <button onClick={handleSaveInvoice} disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg">{isSaving ? 'Saving...' : 'Save Invoice'}</button>
             </div>
          </div>
       )}
       
       {/* Analysis View (Detailed) */}
       {viewMode === 'analysis' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <h2 className="font-bold text-lg">Profit & Margin Analysis</h2>
                   <input 
                      placeholder="Search..." 
                      className="text-sm p-2 border rounded w-64"
                      value={analysisSearch}
                      onChange={e => setAnalysisSearch(e.target.value)}
                   />
                </div>
                <button onClick={() => setViewMode('list')} className="text-gray-500 hover:text-gray-700">Close</button>
             </div>
             <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                   <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Mechanic(s)</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Cost (Parts+Comm)</th>
                      <th className="px-4 py-3 text-right">Net Profit</th>
                      <th className="px-4 py-3 text-right">Margin %</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {analysis.items
                      .filter(i => 
                         !analysisSearch || 
                         i.customerName?.toLowerCase().includes(analysisSearch.toLowerCase()) || 
                         i.invoiceNumber?.toLowerCase().includes(analysisSearch.toLowerCase())
                      )
                      .map(i => {
                        const isReturn = i.invoiceType === 'return_job' || i.parentInvoiceId || i.parentInvoiceNumber;
                        return (
                      <tr key={i.id} className={isReturn ? 'bg-purple-50' : ''}>
                         <td className="px-4 py-3 font-mono">
                            {i.invoiceNumber}
                            {isReturn && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1 rounded font-bold">RETURN</span>}
                            <div className="text-xs text-gray-500">{i.customerName}</div>
                         </td>
                         <td className="px-4 py-3 text-xs">
                            {(i.mechanics || []).map(m => <div key={m.id}>{m.name} ({formatCurrency(m.commissionAmount)})</div>)}
                         </td>
                         <td className="px-4 py-3 text-right font-medium">{formatCurrency(i.customerTotal || i.total)}</td>
                         <td className="px-4 py-3 text-right text-red-500">{formatCurrency(i.calculatedCost)}</td>
                         <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(i.calculatedProfit)}</td>
                         <td className={`px-4 py-3 text-right font-bold ${i.calculatedProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {i.calculatedProfit > 0 ? ((i.calculatedProfit/(i.customerTotal||1))*100).toFixed(0) : 0}%
                         </td>
                      </tr>
                      )
                   })}
                </tbody>
             </table>
             </div>
          </div>
       )}

       {/* Modals */}
       {viewInvoice && (
          showPDF ? (
            <InvoicePreview 
                invoice={{
                    invoiceNumber: viewInvoice.invoiceNumber,
                    dateCreated: viewInvoice.dateCreated,
                    customerInfo: {
                        name: viewInvoice.customerName,
                        phone: viewInvoice.customerPhone,
                        email: viewInvoice.customerEmail
                    },
                    vehicleInfo: viewInvoice.vehicleInfo || {},
                    items: [
                    ...(viewInvoice.partsOrdered || []).map(p => ({
                        kodProduk: p.sku || 'PART',
                        namaProduk: p.partName,
                        quantity: Number(p.quantity),
                        finalPrice: Number(p.pricePerUnit),
                        totalPrice: Number(p.total)
                    })),
                    ...(viewInvoice.laborCharges || []).map(l => ({
                        kodProduk: 'LABOR',
                        namaProduk: l.description,
                        quantity: 1,
                        finalPrice: Number(l.amount),
                        totalPrice: Number(l.amount)
                    }))
                    ],
                    totalAmount: Number(viewInvoice.total || viewInvoice.customerTotal || 0),
                    deposit: Number(viewInvoice.deposit || 0),
                    balanceDue: Number(viewInvoice.balanceDue ?? ((viewInvoice.total || viewInvoice.customerTotal || 0) - (viewInvoice.deposit || 0))),
                    notes: viewInvoice.notes || (viewInvoice.workDescription ? `Work: ${viewInvoice.workDescription}` : '')
                }} 
                onClose={() => setShowPDF(false)} 
                isViewMode={true} 
            />
          ) : (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
               <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="flex justify-between items-center p-6 border-b bg-gray-50">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-800">Invoice: {viewInvoice.invoiceNumber}</h2>
                        <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${viewInvoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{viewInvoice.status || 'Draft'}</span>
                     </div>
                     <div className="flex gap-3">
                         <button onClick={() => setShowPDF(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Print Invoice
                         </button>
                         <button onClick={() => setViewInvoice(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300">Close</button>
                     </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-8 flex-1">
                      {/* Top Section: Customer, Vehicle, Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-5 bg-blue-50/50 rounded-lg border border-blue-100">
                              <h3 className="font-bold text-blue-800 uppercase text-xs mb-3 tracking-wider">Customer Information</h3>
                              <div className="space-y-1">
                                  <p className="font-bold text-lg text-gray-900">{viewInvoice.customerName}</p>
                                  <p className="text-gray-600">{viewInvoice.customerPhone}</p>
                                  <p className="text-sm text-gray-500">{viewInvoice.customerEmail}</p>
                              </div>
                          </div>
                          <div className="p-5 bg-gray-50 rounded-lg border border-gray-100">
                              <h3 className="font-bold text-gray-500 uppercase text-xs mb-3 tracking-wider">Vehicle Details</h3>
                              {viewInvoice.vehicleInfo ? (
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <p className="text-xs text-gray-400 uppercase">Make/Model</p>
                                          <p className="font-bold text-gray-900">{viewInvoice.vehicleInfo.make} {viewInvoice.vehicleInfo.model}</p>
                                      </div>
                                      <div>
                                          <p className="text-xs text-gray-400 uppercase">Start Date</p>
                                          <p className="font-medium text-gray-900">{new Date(viewInvoice.dateCreated?.seconds ? viewInvoice.dateCreated.seconds * 1000 : viewInvoice.dateCreated).toLocaleDateString()}</p>
                                      </div>
                                      <div>
                                         <p className="text-xs text-gray-400 uppercase">Plate No</p>
                                         <p className="font-bold text-gray-900">{viewInvoice.vehicleInfo.plate}</p>
                                      </div>
                                      <div>
                                          <p className="text-xs text-gray-400 uppercase">Odometer</p>
                                          <p className="font-medium text-gray-900">{viewInvoice.vehicleInfo.mileage} km</p>
                                      </div>
                                  </div>
                              ) : <p className="text-gray-400 italic">No vehicle info available</p>}
                          </div>
                      </div>

                      {/* Line Items Table */}
                      <div>
                          <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Service Breakdown</h3>
                          <table className="w-full text-left text-sm">
                              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                                  <tr>
                                      <th className="p-3 rounded-l">Description</th>
                                      <th className="p-3 text-center">Type</th>
                                      <th className="p-3 text-right">Qty</th>
                                      <th className="p-3 text-right">Unit Price</th>
                                      <th className="p-3 text-right rounded-r">Total</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {(viewInvoice.partsOrdered || []).map((p, idx) => (
                                      <tr key={`p-${idx}`}>
                                          <td className="p-3 font-medium text-gray-800">{p.partName}<div className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</div></td>
                                          <td className="p-3 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs border border-blue-100 font-medium">Part</span></td>
                                          <td className="p-3 text-right text-gray-600">{p.quantity}</td>
                                          <td className="p-3 text-right text-gray-600">{formatCurrency(p.pricePerUnit)}</td>
                                          <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(p.total)}</td>
                                      </tr>
                                  ))}
                                  {(viewInvoice.laborCharges || []).map((l, idx) => (
                                      <tr key={`l-${idx}`}>
                                          <td className="p-3 font-medium text-gray-800">{l.description}</td>
                                          <td className="p-3 text-center"><span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs border border-green-100 font-medium">Labor</span></td>
                                          <td className="p-3 text-right text-gray-600">1</td>
                                          <td className="p-3 text-right text-gray-600">{formatCurrency(l.amount)}</td>
                                          <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(l.amount)}</td>
                                      </tr>
                                  ))}
                                  {(!viewInvoice.partsOrdered?.length && !viewInvoice.laborCharges?.length) && (
                                     <tr><td colSpan="5" className="p-8 text-center text-gray-400 italic">No line items found.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>

                      {/* Financial Summary */}
                      <div className="flex flex-col md:flex-row justify-between gap-8 pt-4 border-t">
                          <div className="flex-1 bg-slate-50 p-4 rounded border border-slate-100">
                             <h4 className="font-bold text-slate-500 uppercase text-xs mb-3 tracking-wider">Internal Operations</h4>
                             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                 <div>
                                    <span className="block text-slate-400 text-xs">Assigned Mechanics</span>
                                    <span className="block font-medium text-slate-700">{(viewInvoice.mechanics || []).map(m=>m.name).join(', ') || 'None'}</span>
                                 </div>
                                 {/* Internal Calcs computed on the fly since they might not be stored in raw object */}
                                 {(() => {
                                     const revenue = Number(viewInvoice.total || viewInvoice.customerTotal || 0)
                                     const cost = (Number(viewInvoice.partsSupplierCost) || 0) + (Number(viewInvoice.commissionAmount) || 0)
                                     const profit = revenue - cost
                                     const margin = revenue ? (profit / revenue * 100) : 0
                                     
                                     return (
                                        <>
                                         <div>
                                            <span className="block text-slate-400 text-xs">Total Cost (Parts+Comm)</span>
                                            <span className="block font-semibold text-red-600">{formatCurrency(cost)}</span>
                                         </div>
                                         <div>
                                            <span className="block text-slate-400 text-xs">Net Profit</span>
                                            <span className="block font-semibold text-green-600">{formatCurrency(profit)}</span>
                                         </div>
                                          <div>
                                            <span className="block text-slate-400 text-xs">Margin</span>
                                            <span className={`block font-bold ${profit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                               {margin.toFixed(1)}%
                                            </span>
                                         </div>
                                        </>
                                     )
                                 })()}
                             </div>
                          </div>
                      
                          <div className="w-full md:w-80 space-y-3 bg-white p-4 rounded border shadow-sm">
                               <div className="flex justify-between text-gray-600"><span>Subtotal</span> <span>{formatCurrency(viewInvoice.total || viewInvoice.customerTotal)}</span></div>
                               <div className="flex justify-between text-gray-600"><span>Deposit Paid</span> <span className="text-red-500">-{formatCurrency(viewInvoice.deposit || 0)}</span></div>
                               <div className="border-t pt-2 mt-2">
                                  <div className="flex justify-between items-baseline mb-1">
                                     <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Balance Due</span> 
                                     <span className="text-2xl font-bold text-gray-900">{formatCurrency((viewInvoice.total || viewInvoice.customerTotal) - (viewInvoice.deposit || 0))}</span>
                                  </div>
                               </div>
                          </div>
                      </div>
                      
                  </div>
               </div>
            </div>
         )
       )}

       {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-md h-96 flex flex-col p-4">
                <div className="flex justify-between mb-2"><h3 className="font-bold">Select Customer</h3><button onClick={() => setShowCustomerModal(false)}>x</button></div>
                <input autoFocus placeholder="Search name or phone..." className="p-2 border rounded mb-2" value={customerSearchTerm} onChange={e => setCustomerSearchTerm(e.target.value)} />
                <div className="flex-1 overflow-y-auto">
                   {customers.filter(c => {
                      const term = customerSearchTerm.toLowerCase()
                      return c.name?.toLowerCase().includes(term) || c.phone?.toLowerCase().includes(term)
                   }).map(c => (
                      <div key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false)}} className="p-3 border-b hover:bg-gray-50 cursor-pointer flex justify-between">
                         <span className="font-medium">{c.name}</span>
                         <span className="text-gray-400 text-sm">{c.phone || ''}</span>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       )}

       {paymentLinkModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
                <h3 className="font-bold text-lg mb-4">Payment Link</h3>
                {paymentLinkModal.url ? (
                   <div className="space-y-4">
                      <p className="text-xs bg-green-50 text-green-700 p-2 rounded break-all">{paymentLinkModal.url}</p>
                      
                      <div className="flex gap-2">
                        <button onClick={() => window.open(paymentLinkModal.url)} className="flex-1 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition">
                            Open Link
                        </button>
                        <button onClick={() => {
                            // Copy to clipboard
                            navigator.clipboard.writeText(paymentLinkModal.url);
                            alert("Link copied!");
                        }} className="px-4 py-3 bg-gray-100 text-gray-700 rounded font-bold hover:bg-gray-200" title="Copy">
                            📋
                        </button>
                      </div>

                      {/* Manual Regeneration Option */}
                      <div className="pt-4 border-t border-gray-100">
                          <p className="text-xs text-gray-400 mb-2">Need a different amount or new link?</p>
                          <button onClick={() => setPaymentLinkModal({...paymentLinkModal, url: null})} className="w-full py-2 bg-white text-blue-600 border border-blue-200 rounded font-bold text-sm hover:bg-blue-50">
                              Create {paymentLinkModal.invoice.depositStatus?.includes('paid') ? 'Balance' : 'New'} Link
                          </button>
                      </div>

                      <button onClick={() => setPaymentLinkModal({...paymentLinkModal, show: false})} className="w-full text-gray-500 mt-2">Close</button>
                      
                      {!paymentLinkModal.confirmed && paymentLinkModal.invoice.depositStatus !== 'paid_link' && (
                         <div className="bg-yellow-50 p-2 rounded text-xs text-left mt-2">
                            <p className="font-bold">Admin Verification:</p>
                            <p className="mb-2">Did customer pay via this link?</p>
                            <button onClick={() => { confirmDepositPaid(paymentLinkModal.invoice); setPaymentLinkModal(false) }} className="w-full py-1 bg-yellow-400 font-bold rounded">Yes, Mark Deposit Paid</button>
                         </div>
                      )}
                   </div>
                ) : (
                   <div className="space-y-4">
                      <div className="flex flex-col items-center">
                         <label className="text-xs font-bold text-gray-500 uppercase mb-1">Amount to Collect (RM)</label>
                         <input 
                             type="number" 
                             value={paymentLinkModal.amount} 
                             onChange={e => setPaymentLinkModal({...paymentLinkModal, amount: e.target.value})}
                             className="text-3xl font-bold w-full text-center border-b-2 border-gray-200 focus:outline-none focus:border-blue-600 py-2"
                             placeholder="0.00"
                         />
                      </div>
                      {paymentLinkModal.error && <p className="text-xs text-red-500">{paymentLinkModal.error}</p>}
                      <button onClick={generateLink} disabled={paymentLinkModal.loading || !paymentLinkModal.amount} className="w-full py-3 bg-blue-600 text-white rounded font-bold disabled:opacity-50">{paymentLinkModal.loading?'Generating...':'Generate Link'}</button>
                      <button onClick={() => setPaymentLinkModal({...paymentLinkModal, show: false})} className="w-full text-gray-500">Cancel</button>
                   </div>
                )}
             </div>
          </div>
       )}
       
       <style>{`.input-std { width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; } .input-sm { padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; }`}</style>
    </div>
  )
}

export default CustomerInvoiceCreation
