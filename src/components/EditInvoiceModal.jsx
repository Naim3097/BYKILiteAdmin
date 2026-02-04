/**
 * Edit Invoice Modal - Advanced invoice editing with stock reconciliation
 * Mobile-first responsive design following OXHUB strict design rules
 */

import { useState, useEffect, useCallback } from 'react'
import { useInvoiceContext } from '../context/InvoiceContext'
import { usePartsContext } from '../context/PartsContext'
import PartsSelector from './PartsSelector'
import StockChangeSummary from './StockChangeSummary'
import { useInvoiceEditor } from '../hooks/useInvoiceEditor'

function EditInvoiceModal({ invoice, onClose, onSuccess }) {
  console.log('🔧 EditInvoiceModal rendered with invoice:', invoice?.id, invoice?.invoiceNumber)
  
  const { parts, loading: partsLoading, validateStockChanges } = usePartsContext()
  const { saveInvoiceEdit } = useInvoiceContext()
  
  // Use our specialized invoice editor hook - pass invoice as prop for immediate availability
  const {
    editSession,
    isEditing,
    isDirty,
    isValid,
    validationErrors,
    validationWarnings,
    stockAnalysis,
    startEdit,
    updateEdit,
    saveEdit,
    cancelEdit,
    loading: invoiceLoading
  } = useInvoiceEditor(invoice?.id, invoice)
  
  console.log('🔧 EditInvoiceModal hook state:', { 
    isEditing, 
    hasSession: !!editSession,
    partsLoading,
    invoiceLoading,
    invoiceId: invoice?.id,
    invoiceNumber: invoice?.invoiceNumber
  })

  // Local state for UI
  const [selectedParts, setSelectedParts] = useState([])
  const [customerInfo, setCustomerInfo] = useState({})
  const [notes, setNotes] = useState('')
  const [showPartsSelector, setShowPartsSelector] = useState(false)
  const [showStockSummary, setShowStockSummary] = useState(false)
  const [totalPartsSupplierCost, setTotalPartsSupplierCost] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [localValidation, setLocalValidation] = useState({ errors: [], warnings: [] })

  // Initialize edit session when modal opens
  useEffect(() => {
    console.log('🔧 useEffect triggered - invoice:', invoice?.id, 'isEditing:', isEditing)
    if (invoice && !isEditing) {
      console.log('🔧 Starting edit session...')
      const session = startEdit()
      console.log('🔧 Edit session started:', session)
      if (session) {
        setSelectedParts([...session.currentInvoice.items])
        setCustomerInfo(session.currentInvoice.customerInfo || {
          name: 'One X Transmission',
          contact: '+60 11-3105 1677',
          address: '15-G, JLN SG RASAU, KG SG RASAU, 42700 BANTING, SELANGOR'
        })
        setNotes(session.currentInvoice.notes || '')
        setTotalPartsSupplierCost(session.currentInvoice.partsSupplierCost || session.currentInvoice.totalPartsSupplierCost || 0)
        console.log('🔧 State initialized with parts:', session.currentInvoice.items.length)
      } else {
        console.error('❌ Failed to start edit session!')
      }
    }
  }, [invoice, isEditing, startEdit])

  // Real-time validation when parts change
  const validateChanges = useCallback(() => {
    if (!selectedParts.length) return

    const requiredStock = selectedParts.map(item => ({
      partId: item.partId,
      requiredStock: item.quantity
    }))

    const validation = validateStockChanges(requiredStock)
    setLocalValidation(validation)

    // Update edit session with latest changes
    if (editSession) {
      const updatedInvoice = {
        ...editSession.currentInvoice,
        items: selectedParts,
        customerInfo,
        notes,
        partsSupplierCost: totalPartsSupplierCost, // Ensure DB field match
        totalPartsSupplierCost, // Keep state field
        subtotal: calculateSubtotal(),
        totalAmount: calculateTotal()
      }
      updateEdit(updatedInvoice, parts)
    }
  }, [selectedParts, customerInfo, notes, totalPartsSupplierCost, parts, editSession, updateEdit, validateStockChanges])

  // Validate changes when data changes
  useEffect(() => {
    validateChanges()
  }, [validateChanges])

  // Calculate totals
  const calculateSubtotal = useCallback(() => {
    return selectedParts.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  }, [selectedParts])

  const calculateTotal = useCallback(() => {
    return calculateSubtotal() // No taxes for now
  }, [calculateSubtotal])

  // Handle part updates from selector
  const handlePartUpdate = (partId, updates) => {
    setSelectedParts(prev => prev.map(item => 
      item.partId === partId 
        ? { 
            ...item, 
            ...updates,
            totalPrice: updates.finalPrice * updates.quantity
          }
        : item
    ))
  }

  // Handle part removal
  const handlePartRemove = (partId) => {
    setSelectedParts(prev => prev.filter(item => item.partId !== partId))
  }

  // Handle new part addition
  const handlePartAdd = (part, quantity, markupType, markupValue) => {
    const finalPrice = markupType === 'percentage' 
      ? part.harga * (1 + markupValue / 100)
      : part.harga + markupValue

    const newItem = {
      partId: part.id,
      kodProduk: part.kodProduk,
      namaProduk: part.namaProduk,
      originalPrice: part.harga,
      quantity,
      markupType,
      markupValue,
      finalPrice,
      totalPrice: finalPrice * quantity
    }

    setSelectedParts(prev => {
      // Check if part already exists
      const existingIndex = prev.findIndex(item => item.partId === part.id)
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          totalPrice: updated[existingIndex].finalPrice * (updated[existingIndex].quantity + quantity)
        }
        return updated
      } else {
        // Add new item
        return [...prev, newItem]
      }
    })
  }

  // Save changes
  const handleSave = async () => {
    if (!isValid || localValidation.errors.length > 0) {
      alert('Please fix all validation errors before saving.')
      return
    }

    if (selectedParts.length === 0) {
      alert('Please add at least one part to the invoice.')
      return
    }

    setIsSaving(true)
    try {
      const result = await saveEdit(parts)
      if (result.success) {
        onSuccess?.(result.invoice)
        onClose()
      } else {
        alert(`Save failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert(`Error saving invoice: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel editing
  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        cancelEdit()
        onClose()
      }
    } else {
      cancelEdit()
      onClose()
    }
  }

  // Loading state
  if (!invoice || partsLoading || invoiceLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner mr-3"></div>
            <span className="text-black-75">
              {!invoice ? 'Loading invoice...' : 'Loading parts...'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  console.log('🔧 EditInvoiceModal rendering main content - selectedParts:', selectedParts.length)

  const subtotal = calculateSubtotal()
  const total = calculateTotal()
  const allErrors = [...(validationErrors || []), ...(localValidation.errors || [])]
  const allWarnings = [...(validationWarnings || []), ...(localValidation.warnings || [])]
  const canSave = isValid && allErrors.length === 0 && selectedParts.length > 0 && !isSaving

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-6xl">
        {/* Modal Header - Sticky on mobile */}
        <div className="sticky top-0 bg-primary-white border-b border-black-25 p-4 sm:p-6 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-primary-black">
                Edit Invoice
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-sm text-black-75 mt-1">
                <span>{invoice.invoiceNumber}</span>
                <span>•</span>
                <span>Created: {new Date(invoice.dateCreated).toLocaleDateString()}</span>
                {isDirty && (
                  <>
                    <span>•</span>
                    <span className="text-primary-red font-medium">Unsaved Changes</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-black-50 hover:text-primary-black text-2xl leading-none p-2 -m-2 sm:self-start"
            >
              ×
            </button>
          </div>

          {/* Validation Status */}
          {(allErrors.length > 0 || allWarnings.length > 0) && (
            <div className="mt-4 space-y-2">
              {allErrors.map((error, index) => (
                <div key={`error-${index}`} className="bg-red-50 border border-primary-red rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-primary-red font-medium text-sm">⚠️</span>
                    <div className="text-sm">
                      <div className="font-medium text-primary-red">{error.message}</div>
                      {error.context?.suggestedAction && (
                        <div className="text-black-75 mt-1">{error.context.suggestedAction}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {allWarnings.map((warning, index) => (
                <div key={`warning-${index}`} className="bg-yellow-50 border border-yellow-400 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 font-medium text-sm">⚠️</span>
                    <div className="text-sm">
                      <div className="font-medium text-yellow-800">{warning.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Customer Information */}
          <div className="card">
            <h4 className="font-semibold text-primary-black mb-4">Customer Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-black mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerInfo.name || ''}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-black mb-2">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={customerInfo.contact || ''}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, contact: e.target.value }))}
                  className="input-field"
                  placeholder="Phone number"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-primary-black mb-2">
                  Address
                </label>
                <textarea
                  value={customerInfo.address || ''}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                  className="input-field h-20 resize-none"
                  placeholder="Customer address"
                />
              </div>
            </div>
          </div>

          {/* Parts Selection */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h4 className="font-semibold text-primary-black">
                Invoice Items ({selectedParts.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {stockAnalysis && (
                  <button
                    onClick={() => setShowStockSummary(!showStockSummary)}
                    className="btn-secondary text-sm"
                  >
                    📦 Stock Impact ({stockAnalysis.summary.totalStockAffected})
                  </button>
                )}
                <button
                  onClick={() => setShowPartsSelector(true)}
                  className="btn-primary text-sm"
                >
                  + Add Parts
                </button>
              </div>
            </div>

            {/* Stock Change Summary */}
            {showStockSummary && stockAnalysis && (
              <div className="mb-4">
                <StockChangeSummary analysis={stockAnalysis} />
              </div>
            )}

            {/* Selected Parts List */}
            {selectedParts.length === 0 ? (
              <div className="text-center py-8 text-black-50">
                <div className="text-2xl mb-2">📦</div>
                <div>No parts selected</div>
                <div className="text-sm mt-1">Add parts to continue editing</div>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedParts.map((item, index) => (
                  <div key={`${item.partId}-${index}`} className="border border-black-25 rounded-md p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-primary-black">{item.namaProduk}</div>
                        <div className="text-sm text-black-75">Code: {item.kodProduk}</div>
                        <div className="text-sm text-black-75">
                          Original: RM {item.originalPrice?.toFixed(2)} | 
                          Markup: {item.markupType === 'percentage' ? `${item.markupValue}%` : `RM ${item.markupValue}`} | 
                          Final: RM {item.finalPrice?.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-black-75">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handlePartUpdate(item.partId, { 
                              quantity: parseInt(e.target.value) || 1 
                            })}
                            className="w-16 px-2 py-1 text-sm border border-black-25 rounded"
                          />
                        </div>
                        
                        <div className="text-right">
                          <div className="font-semibold text-primary-black">
                            RM {item.totalPrice?.toFixed(2)}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handlePartRemove(item.partId)}
                          className="text-primary-red hover:bg-red-50 p-1 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <label className="block text-sm font-medium text-primary-black mb-2">
              Notes <span className="text-black-50">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field h-20 resize-none"
              placeholder="Additional notes for this invoice..."
            />
          </div>

          {/* Internal Cost Management */}
          <div className="card bg-gray-50 border border-black-10">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-lg opacity-75">🔒</span>
                <h4 className="font-semibold text-primary-black">Internal Cost Management</h4>
             </div>
             <div>
                <label className="block text-sm font-medium text-black-75 mb-2">
                   Total Parts Cost (Supplier)
                </label>
                <div className="relative rounded-md shadow-sm">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">RM</span>
                   </div>
                   <input
                      type="number"
                      step="0.01"
                      className="input-field pl-12 bg-white"
                      value={totalPartsSupplierCost || ''}
                      onChange={(e) => setTotalPartsSupplierCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                   />
                </div>
                <p className="mt-1 text-xs text-black-50 font-medium">
                   For job profitability tracking. Visible to admins only.
                </p>
             </div>
          </div>

          {/* Invoice Summary */}
          <div className="card bg-black-5">
            <h4 className="font-semibold text-primary-black mb-4">Invoice Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-black-75">Subtotal:</span>
                <span className="font-medium">RM {subtotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-black-25 pt-2">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-primary-black">RM {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions */}
        <div className="sticky bottom-0 bg-primary-white border-t border-black-25 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleCancel}
              className="btn-secondary order-2 sm:order-1 min-h-[44px]"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`btn-primary order-1 sm:order-2 min-h-[44px] ${
                !canSave ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!canSave}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="loading-spinner"></div>
                  Saving Changes...
                </span>
              ) : (
                `Save Changes (RM ${total.toFixed(2)})`
              )}
            </button>
          </div>
          
          {/* Save status info */}
          <div className="mt-2 text-xs text-black-75">
            {!canSave && allErrors.length > 0 && (
              <div className="text-primary-red">Fix validation errors to save</div>
            )}
            {!canSave && selectedParts.length === 0 && (
              <div className="text-primary-red">Add at least one part to save</div>
            )}
            {isDirty && canSave && (
              <div className="text-green-600">Ready to save changes</div>
            )}
          </div>
        </div>

        {/* Parts Selector Modal */}
        {showPartsSelector && (
          <PartsSelector
            parts={parts}
            onAddPart={handlePartAdd}
            onClose={() => setShowPartsSelector(false)}
            existingParts={selectedParts}
          />
        )}
      </div>
    </div>
  )
}

export default EditInvoiceModal
