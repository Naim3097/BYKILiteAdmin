import React, { useRef, useState } from 'react'
import { logoBase64 } from '../assets/logo'

const InvoicePreview = ({ invoice, onClose, isViewMode = false, renderTrigger }) => {
  const printRef = useRef()
  
  const handlePrint = () => {
    const printContent = printRef.current
    // Build clean filename: Invoice_INV-xxx_CustomerName_Date
    const cleanName = (customerInfo.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '')
    const dateStr = (dateCreated instanceof Date ? dateCreated : new Date()).toISOString().split('T')[0]
    const pdfFileName = `Invoice_${invoiceNumber}_${cleanName}_${dateStr}`
    const windowPrint = window.open('', '', 'width=900,height=600')
    windowPrint.document.write(`<html><head><title>${pdfFileName}</title>`)
    windowPrint.document.write('<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">')
    windowPrint.document.write(`
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        @page { 
          size: A4; 
          margin: 15mm 15mm 15mm 15mm; /* Top Right Bottom Left - Creates the gap on every page */
        }

        body { 
          font-family: 'Inter', sans-serif;
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
          background: white;
          margin: 0;
        }

        /* Container adjustment for print to avoid double margins */
        .page-container {
          width: 100%;
          margin: 0;
          padding: 0; 
          box-sizing: border-box;
          background: white;
        } 

        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; } /* Essential for repeating headers */
        tr { page-break-inside: avoid; }
        .page-break { page-break-before: always; }

        @media print {
          body { margin: 0; }
          .no-print { display: none; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      </style>
    `)
    windowPrint.document.write('</head><body>')
    // Remove class restriction here so it flows naturally with @page margins
    windowPrint.document.write('<div class="page-container">')
    windowPrint.document.write(printContent.innerHTML)
    windowPrint.document.write('</div>')
    windowPrint.document.write('</body></html>')
    windowPrint.document.close()
    windowPrint.focus()
    setTimeout(() => {
        windowPrint.print()
        windowPrint.close()
    }, 500)
  }

  // Fallbacks
  const { 
    invoiceNumber = 'DRAFT', 
    dateCreated = new Date(), 
    customerInfo = {}, 
    items = [], 
    vehicleInfo = {},
    totalAmount = 0,
    deposit = 0,
    balanceDue = 0,
    notes = ''
  } = invoice || {}

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0)
  }

  const currentDate = dateCreated instanceof Date ? dateCreated.toLocaleDateString() : new Date(dateCreated.seconds * 1000).toLocaleDateString()

  // Ensure items have necessary fields for display
  const displayItems = items.map(item => ({
     description: item.name || item.description || item.namaProduk,
     qty: item.quantity || 1,
     price: item.price || item.unitPrice || item.finalPrice || 0,
     total: item.total || item.totalPrice || ((item.price || item.unitPrice || 0) * (item.quantity || 1)) || 0,
     type: item.type || 'part'
  }))

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 font-sans">
      <div className="bg-white w-full max-w-4xl h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
        
        {/* Toolbar */}
        {!renderTrigger && (
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md print:hidden">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Invoice Preview
          </h2>
          <div className="flex gap-3">
            <button 
              onClick={handlePrint} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print / PDF
            </button>
            <button 
              onClick={onClose} 
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
        )}

        {/* Invoice Content - Shared between Screen Preview and Print */}
        {renderTrigger ? (
            // Hidden mode if using a custom trigger - Use Fragments to separate hidden content from visible trigger
            <>
            <div className="hidden">
                 <div ref={printRef} className="w-full h-full flex flex-col text-gray-800">
                     {/* Header: Centered Logo & Meta Bar */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="mb-6">
                            {logoBase64 ? (
                                <img src={logoBase64} alt="Company Logo" className="h-14 w-auto object-contain" />
                            ) : (
                                <h1 className="text-xl font-bold text-blue-900 tracking-tight">ONE X TRANSMISSION</h1>
                            )}
                        </div>
                        
                        {/* Meta Data Strap */}
                        <div className="w-full flex justify-between items-center border-y border-gray-100 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invoice</span>
                                <span className="text-sm font-bold text-gray-900 font-mono">#{invoiceNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</span>
                                <span className="text-sm font-medium text-gray-900">{currentDate}</span>
                            </div>
                        </div>
                    </div>
                     {/* Rest of the invoice structure should be here but to allow reuse I need to refactor or duplicate the render logic. 
                         For simplicity, I will use "renderTrigger" only for the button which calls handlePrint defined here, 
                         but I still need to render the content HIDDEN so the print function can grab it.
                     */}
                     {/* Client & Vehicle Info Grid */}
                        <div className="flex gap-8 mb-8 items-start text-xs">
                        {/* Bill To */}
                        <div className="w-1/2">
                            <p className="uppercase text-[10px] font-bold text-gray-400 tracking-wider mb-2 border-b border-gray-100 pb-1">
                                Billed To
                            </p>
                            <h3 className="text-sm font-bold text-gray-900 mb-1">{customerInfo.name || 'Walk-in Customer'}</h3>
                            <div className="text-gray-500 space-y-0.5">
                                <p>{customerInfo.phone}</p>
                                <p>{customerInfo.email}</p>
                                {customerInfo.ic && <p>IC: {customerInfo.ic}</p>}
                                {customerInfo.address && <p>{customerInfo.address}</p>}
                            </div>
                        </div>
                        
                        {/* Vehicle Info */}
                        <div className="w-1/2">
                            <p className="uppercase text-[10px] font-bold text-gray-400 tracking-wider mb-2 border-b border-gray-100 pb-1">
                                Vehicle Details
                            </p>
                            <div className="grid grid-cols-2 gap-y-1 text-gray-600">
                                {vehicleInfo.make && (
                                    <>
                                    <span className="text-gray-400">Make/Model</span>
                                    <span className="font-semibold text-right text-gray-900">{vehicleInfo.make} {vehicleInfo.model}</span>
                                    </>
                                )}
                                
                                {vehicleInfo.plate && (
                                    <>
                                    <span className="text-gray-400">Plate No</span>
                                    <span className="font-semibold text-right text-gray-900">{vehicleInfo.plate}</span>
                                    </>
                                )}
                                
                                {vehicleInfo.year && (
                                    <>
                                    <span className="text-gray-400">Year</span>
                                    <span className="font-semibold text-right text-gray-900">{vehicleInfo.year}</span>
                                    </>
                                )}
                                
                                {vehicleInfo.mileage && (
                                    <>
                                    <span className="text-gray-400">Mileage</span>
                                    <span className="font-semibold text-right text-gray-900">{vehicleInfo.mileage}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-4">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-y border-gray-200 uppercase tracking-wider">
                                <tr>
                                    <th className="py-2 pl-2">#</th>
                                    <th className="py-2">Description</th>
                                    <th className="py-2 text-center">Qty</th>
                                    <th className="py-2 text-right">Price</th>
                                    <th className="py-2 text-right pr-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayItems.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                    <td className="py-2 pl-2 text-gray-400 font-mono text-[10px]">{index + 1}</td>
                                    <td className="py-2 font-medium text-gray-800">{item.description}</td>
                                    <td className="py-2 text-center text-gray-600">{item.qty}</td>
                                    <td className="py-2 text-right text-gray-600">{formatCurrency(item.price)}</td>
                                    <td className="py-2 text-right font-bold text-gray-900 pr-2">{formatCurrency(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>

                        {/* spacer to push footer down if content is short, 
                            but let it flow if long. 
                            Using margin-top: auto on footer section effectively does this in flex col */}
                        <div className="flex-grow"></div>

                        {/* Footer Summary / Totals */}
                        <div className="flex justify-end pt-4 mb-4 avoid-break">
                        <div className="w-1/2 md:w-5/12">
                            <div className="flex justify-between text-gray-500 text-xs mb-1 px-3">
                                <span>Subtotal</span>
                                <span className="font-medium text-gray-900">{formatCurrency(totalAmount + (invoice.discountAmount || 0))}</span>
                            </div>
                            
                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between text-red-500 text-xs mb-1 px-3">
                                    <span>Discount {invoice.discountType === 'fixed' ? '(Fixed)' : `(${invoice.discount || 0}%)`}</span>
                                    <span>- {formatCurrency(invoice.discountAmount)}</span>
                                </div>
                            )}
                            
                            {deposit > 0 && (
                                <div className="flex justify-between text-green-600 text-xs font-bold bg-green-50 p-2 rounded mb-1 mx-3">
                                    <span>Paid Deposit</span>
                                    <span>-{formatCurrency(deposit)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-gray-900 text-white p-3 rounded shadow-sm mt-2">
                                <span className="font-semibold text-sm">Total Due</span>
                                <span className="font-bold text-lg">{formatCurrency(balanceDue)}</span>
                            </div>
                        </div>
                        </div>
                        
                        {/* Notes & Terms */}
                        <div className="grid grid-cols-1 gap-6 pt-4 border-t border-gray-200 avoid-break">
                            <div className="flex gap-8 items-start text-[10px] text-gray-500 leading-relaxed">
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800 uppercase mb-1">Payment Instructions</p>
                                    <p>1. Payments can be made via Cash, Credit Card, or Online Transfer.</p>
                                    <p>2. Please transfer to the account below and send proof of payment.</p>
                                    <div className="mt-2 text-gray-800 font-mono bg-gray-100 inline-block px-2 py-1 rounded border border-gray-200">
                                    MAYBANK: <b>562786117821</b> <span className="mx-2">|</span> OneXtransmission
                                    </div>
                                </div>
                                {notes && (
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800 uppercase mb-1">Notes</p>
                                    <p className="italic">{notes}</p>
                                </div>
                                )}
                            </div>
                            
                            <div className="text-center pt-4">
                                <p className="text-[9px] text-gray-300 uppercase tracking-widest font-semibold">Thank you for your business</p>
                            </div>
                        </div>
                 </div> 
                 {/* Trigger Button Rendered Normally via Fragment sibling in PaymentReceipt.jsx, 
                     but here we need to not wrap it in hidden div. 
                     Refactoring to Fragment approach to fix "blank screen" issue. */}
            </div>
            {/* The Trigger Button - Rendered OUTSIDE the hidden div */}
             {renderTrigger(handlePrint)}
        </>
        ) : (
        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
          
          {/* CONTENT TO PRINT - Also used as Screen Preview */}
          <div ref={printRef} className="bg-white shadow-lg max-w-[210mm] w-full mx-auto p-10 flex flex-col text-gray-800" style={{minHeight: '297mm'}}>
            
            {/* Header: Centered Logo & Meta Bar */}
            <div className="flex flex-col items-center mb-6">
               <div className="mb-6">
                  {logoBase64 ? (
                      <img src={logoBase64} alt="Company Logo" className="h-14 w-auto object-contain" />
                  ) : (
                      <h1 className="text-xl font-bold text-blue-900 tracking-tight">ONE X TRANSMISSION</h1>
                  )}
               </div>
               
               {/* Meta Data Strap */}
               <div className="w-full flex justify-between items-center border-y border-gray-100 py-3">
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invoice</span>
                     <span className="text-sm font-bold text-gray-900 font-mono">#{invoiceNumber}</span>
                  </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</span>
                     <span className="text-sm font-medium text-gray-900">{currentDate}</span>
                  </div>
               </div>
            </div>

            {/* Client & Vehicle Info Grid */}
            <div className="flex gap-8 mb-8 items-start text-xs">
               {/* Bill To */}
               <div className="w-1/2">
                  <p className="uppercase text-[10px] font-bold text-gray-400 tracking-wider mb-2 border-b border-gray-100 pb-1">
                    Billed To
                  </p>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{customerInfo.name || 'Walk-in Customer'}</h3>
                  <div className="text-gray-500 space-y-0.5">
                     {customerInfo.phone && <p>{customerInfo.phone}</p>}
                     {customerInfo.email && <p>{customerInfo.email}</p>}
                     {customerInfo.ic && <p>IC: {customerInfo.ic}</p>}
                     {customerInfo.address && <p>{customerInfo.address}</p>}
                  </div>
               </div>
               
               {/* Vehicle Info */}
               <div className="w-1/2">
                  <p className="uppercase text-[10px] font-bold text-gray-400 tracking-wider mb-2 border-b border-gray-100 pb-1">
                    Vehicle Details
                  </p>
                  <div className="grid grid-cols-2 gap-y-1 text-gray-600">
                      {vehicleInfo.make && (
                        <>
                           <span className="text-gray-400">Make/Model</span>
                           <span className="font-semibold text-right text-gray-900">{vehicleInfo.make} {vehicleInfo.model}</span>
                        </>
                      )}
                      
                      {vehicleInfo.plate && (
                        <>
                           <span className="text-gray-400">Plate No</span>
                           <span className="font-semibold text-right text-gray-900">{vehicleInfo.plate}</span>
                        </>
                      )}
                      
                      {vehicleInfo.year && (
                        <>
                           <span className="text-gray-400">Year</span>
                           <span className="font-semibold text-right text-gray-900">{vehicleInfo.year}</span>
                        </>
                      )}
                      
                      {vehicleInfo.mileage && (
                          <>
                           <span className="text-gray-400">Mileage</span>
                           <span className="font-semibold text-right text-gray-900">{vehicleInfo.mileage}</span>
                          </>
                      )}
                  </div>
               </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-0 overflow-hidden border-t border-gray-900">
               <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-white">
                     <tr>
                        <th className="py-2 px-3 text-left font-semibold text-xs border-r border-gray-700 w-12">#</th>
                        <th className="py-2 px-3 text-left font-semibold text-xs border-r border-gray-700">Description</th>
                        <th className="py-2 px-3 text-center font-semibold text-xs border-r border-gray-700 w-16">Qty</th>
                        <th className="py-2 px-3 text-right font-semibold text-xs border-r border-gray-700 w-28">Price</th>
                        <th className="py-2 px-3 text-right font-semibold text-xs w-32">Total</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {displayItems.length > 0 ? displayItems.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                           <td className="py-2 px-3 text-gray-400 text-xs border-r border-gray-100">{index + 1}</td>
                           <td className="py-2 px-3 font-medium text-gray-800 text-xs border-r border-gray-100">
                               {item.description}
                               {item.type === 'labor' && <span className="ml-2 px-1 py-0.5 bg-blue-50 text-blue-600 rounded-[2px] text-[9px] uppercase tracking-wide">Labor</span>}
                           </td>
                           <td className="py-2 px-3 text-center text-gray-600 text-xs border-r border-gray-100">{item.qty}</td>
                           <td className="py-2 px-3 text-right text-gray-600 text-xs border-r border-gray-100">{formatCurrency(item.price)}</td>
                           <td className="py-2 px-3 text-right font-bold text-gray-900 text-xs">{formatCurrency(item.total)}</td>
                        </tr>
                     )) : (
                        <tr><td colSpan="5" className="py-8 text-center text-gray-400 italic">No items added to this invoice.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>

            {/* Spacer to push footer down */}
            <div className="flex-grow"></div>

            {/* Footer Summary / Totals */}
            <div className="flex justify-end pt-4 mb-4 avoid-break">
               <div className="w-1/2">
                  <div className="flex justify-between text-gray-500 text-xs mb-1 px-3">
                     <span>Subtotal</span>
                     <span className="font-medium text-gray-900">{formatCurrency(totalAmount + (invoice.discountAmount || 0))}</span>
                  </div>
                  
                  {invoice.discountAmount > 0 && (
                     <div className="flex justify-between text-red-500 text-xs mb-1 px-3">
                        <span>Discount {invoice.discountType === 'fixed' ? '(Fixed)' : `(${invoice.discount || 0}%)`}</span>
                        <span>- {formatCurrency(invoice.discountAmount)}</span>
                     </div>
                  )}
                  
                  {deposit > 0 && (
                     <div className="flex justify-between text-green-600 text-xs font-bold bg-green-50 p-2 rounded mb-1 mx-3">
                        <span>Paid Deposit</span>
                        <span>-{formatCurrency(deposit)}</span>
                     </div>
                  )}

                  <div className="flex justify-between items-center bg-gray-900 text-white p-3 rounded shadow-sm mt-2">
                     <span className="font-semibold text-sm">Total Due</span>
                     <span className="font-bold text-lg">{formatCurrency(balanceDue)}</span>
                  </div>
               </div>
            </div>
            
            {/* Notes & Terms */}
            <div className="grid grid-cols-1 gap-6 pt-4 border-t border-gray-200 avoid-break">
                <div className="flex gap-8 items-start text-[10px] text-gray-500 leading-relaxed">
                    <div className="flex-1">
                        <p className="font-bold text-gray-800 uppercase mb-1">Payment Instructions</p>
                        <p>1. Payments can be made via Cash, Credit Card, or Online Transfer.</p>
                        <p>2. Please transfer to the account below and send proof of payment.</p>
                        <div className="mt-2 text-gray-800 font-mono bg-gray-100 inline-block px-2 py-1 rounded border border-gray-200">
                           MAYBANK: <b>562786117821</b> <span className="mx-2">|</span> OneXtransmission
                        </div>
                    </div>
                    {notes && (
                       <div className="flex-1">
                           <p className="font-bold text-gray-800 uppercase mb-1">Notes</p>
                           <p className="italic">{notes}</p>
                       </div>
                    )}
                </div>
                
                <div className="text-center pt-4">
                     <p className="text-[9px] text-gray-300 uppercase tracking-widest font-semibold">Thank you for your business</p>
                </div>
            </div>
        </div>
      </div>
      )}
    </div>
    </div>
  )
}

export default InvoicePreview
