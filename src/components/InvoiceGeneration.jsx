import { useState } from 'react'
import { usePartsContext } from '../context/PartsContext'
import { useInvoiceContext } from '../context/InvoiceContext'
import PartsSelector from './PartsSelector'
import InvoicePreview from './InvoicePreview'

function InvoiceGeneration({ setActiveSection }) {
  const { parts, updateStock } = usePartsContext()
  const { createInvoice, generateInvoiceNumber } = useInvoiceContext()
  
  const [selectedParts, setSelectedParts] = useState([])
  const [customerInfo, setCustomerInfo] = useState({
    name: 'Walk-in Customer',
    phone: '',
    address: ''
  })
  const [notes, setNotes] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [generatedInvoice, setGeneratedInvoice] = useState(null)

  // --- Logic ---
  const addPartToInvoice = (part, quantity = 1) => {
    const existingIndex = selectedParts.findIndex(item => item.partId === part.id)
    if (existingIndex >= 0) {
      const updatedParts = [...selectedParts]
      updatedParts[existingIndex].quantity += quantity
      updatedParts[existingIndex].totalPrice = updatedParts[existingIndex].finalPrice * updatedParts[existingIndex].quantity
      setSelectedParts(updatedParts)
    } else {
      const finalPrice = part.harga * 1.2
      const newItem = {
        partId: part.id,
        kodProduk: part.kodProduk,
        namaProduk: part.namaProduk,
        originalPrice: part.harga,
        quantity: quantity,
        markupType: 'percentage',
        markupValue: 20,
        finalPrice: finalPrice,
        totalPrice: finalPrice * quantity
      }
      setSelectedParts([...selectedParts, newItem])
    }
  }

  const updatePartMarkup = (partId, markupType, markupValue) => {
    setSelectedParts(parts => parts.map(item => {
      if (item.partId === partId) {
        let finalPrice = markupType === 'percentage' 
          ? item.originalPrice * (1 + markupValue / 100)
          : item.originalPrice + parseFloat(markupValue)
        
        return {
          ...item,
          markupType,
          markupValue,
          finalPrice,
          totalPrice: finalPrice * item.quantity
        }
      }
      return item
    }))
  }

  const updateQuantity = (partId, newQty) => {
     if (newQty < 1) return removePart(partId)
     setSelectedParts(parts => parts.map(item => {
        if (item.partId === partId) {
           return { ...item, quantity: newQty, totalPrice: item.finalPrice * newQty }
        }
        return item
     }))
  }

  const removePart = (partId) => {
     setSelectedParts(filter => filter.filter(i => i.partId !== partId))
  }

  const handleGenerateInvoice = async () => {
    if (selectedParts.length === 0) return alert("Cart is empty")
    
    const invoiceData = {
       customerInfo,
       items: selectedParts,
       subtotal: selectedParts.reduce((acc, i) => acc + i.totalPrice, 0),
       dateCreated: new Date(),
       notes
    }
    
    // Logic to save skipped for UI speed (mocking success)
    const newInvoice = await createInvoice(invoiceData)
    if (newInvoice.success) {
       setGeneratedInvoice(newInvoice.invoice)
       setShowPreview(true)
       // clear cart
       setSelectedParts([])
    } else {
       alert("Failed to create Invoice")
    }
  }
  
  const formatCurrency = (val) => new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(val || 0)
  const cartTotal = selectedParts.reduce((acc, i) => acc + i.totalPrice, 0)

  if (showPreview && generatedInvoice) {
     return <InvoicePreview invoice={generatedInvoice} onBack={() => setShowPreview(false)} />
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
       
       {/* Left: Product Selector */}
       <div className="lg:w-3/5 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-none">
             <h2 className="text-xl font-bold text-gray-800">Product Catalog</h2>
             <p className="text-xs text-gray-500">Select items to add to invoice</p>
          </div>
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <PartsSelector onSelectPart={addPartToInvoice} /> 
                {/* Assuming PartsSelector handles its own display functionality well enough for now */}
             </div>
          </div>
       </div>

       {/* Right: Cart & Invoice Details */}
       <div className="lg:w-2/5 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
             
             {/* Customer Header */}
             <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
                <h3 className="font-bold text-gray-700 uppercase tracking-wide text-xs">Customer Details</h3>
                <input 
                  type="text" 
                  placeholder="Customer Name" 
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Phone Number" 
                  className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})}
                />
             </div>

             {/* Cart Items */}
             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {selectedParts.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                      <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <p>Cart is empty</p>
                   </div>
                ) : (
                   selectedParts.map((item, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100 relative group">
                         <div className="flex justify-between items-start">
                            <div className="pr-8">
                               <p className="font-bold text-gray-800 text-sm line-clamp-1">{item.namaProduk}</p>
                               <p className="text-xs text-gray-500 font-mono">{item.kodProduk}</p>
                            </div>
                            <button onClick={() => removePart(item.partId)} className="text-gray-400 hover:text-red-500 absolute top-2 right-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                         
                         <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <button onClick={() => updateQuantity(item.partId, item.quantity - 1)} className="w-6 h-6 bg-white border rounded flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                               <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                               <button onClick={() => updateQuantity(item.partId, item.quantity + 1)} className="w-6 h-6 bg-white border rounded flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                            </div>
                            <div className="text-right">
                               <p className="font-bold text-blue-600">{formatCurrency(item.totalPrice)}</p>
                               <p className="text-[10px] text-gray-500">Unit: {formatCurrency(item.finalPrice)}</p>
                            </div>
                         </div>
                         
                         {/* Markup Controls */}
                         <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Markup</span>
                            <select 
                               className="text-xs p-1 bg-white border border-gray-300 rounded" 
                               value={item.markupType} 
                               onChange={e => updatePartMarkup(item.partId, e.target.value, item.markupValue)}
                            >
                               <option value="percentage">%</option>
                               <option value="fixed">RM</option>
                            </select>
                            <input 
                               type="number" 
                               className="w-16 text-xs p-1 bg-white border border-gray-300 rounded" 
                               value={item.markupValue} 
                               onChange={e => updatePartMarkup(item.partId, item.markupType, e.target.value)}
                            />
                         </div>
                      </div>
                   ))
                )}
             </div>

             {/* Footer Totals */}
             <div className="p-4 bg-white border-t border-gray-200 shadow-up">
                <div className="flex justify-between items-end mb-4">
                   <span className="text-gray-600 font-medium">Total Amount</span>
                   <span className="text-3xl font-bold text-gray-900">{formatCurrency(cartTotal)}</span>
                </div>
                <button 
                  onClick={handleGenerateInvoice}
                  disabled={selectedParts.length === 0}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   Complete Sale
                </button>
             </div>
          </div>
       </div>
    </div>
  )
}

export default InvoiceGeneration
