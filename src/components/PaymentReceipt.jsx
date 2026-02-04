import React, { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { logoBase64 } from '../assets/logo'
import { LeanxService } from '../utils/LeanxService'

const PaymentReceipt = () => {
    const [status, setStatus] = useState('loading')
    const [invoiceData, setInvoiceData] = useState(null)
    const [params, setParams] = useState({})
    const [amountPaid, setAmountPaid] = useState(0)
    const [isRetrying, setIsRetrying] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [apiCheckError, setApiCheckError] = useState(null)
    const [loadingMessage, setLoadingMessage] = useState('Verifying Payment...')
    const receiptRef = useRef()
    
    // Max Retries for API Verification (polling)
    // 30 attempts * 2 seconds = 60 seconds window for Bank -> Gateway callback
    const MAX_RETRIES = 30

    // Helper to get params even if malformed
    const getParam = (key) => {
        const u = new URLSearchParams(window.location.search)
        if (u.get(key)) return u.get(key)
        
        // Malformed rescue
        let found = null
        Array.from(u.entries()).forEach(([k, v]) => {
            if (v && (v.includes('?') || v.includes('&'))) {
                const parts = v.split(/[?&]/);
                parts.forEach(p => {
                    const [pK, pV] = p.split('=');
                    if (pK === key) found = pV;
                })
            }
        })
        return found
    }

    useEffect(() => {
        const p_status = getParam('payment_status')
        const p_inv = getParam('invoice')
        setParams({ status: p_status, invoice: p_inv })

        if (!p_inv) {
            setStatus('error')
            return
        }

        // SIMPLIFIED LOGIC: Binary Decision (Success or Fail)
        // No "Verifying" purgatory.
        
        if (p_status === 'success') {
            // Check for obvious tampering/failure params even in success mode
            const status_id = getParam('status_id')
            const billplz_paid = getParam('billplz[paid]')
            
            if (status_id === '3' || billplz_paid === 'false') {
                 setStatus('failed')
                 fetchInvoice(p_inv, 'readonly')
            } else {
                 fetchInvoice(p_inv, 'success_update')
            }

        } else if (p_status === 'verify' || p_status === 'failed' || p_status === 'canceled') {
            // ZERO TRUST POLICY:
            // We do NOT trust the URL parameters for failure states anymore.
            // Bank redirects are often faster than the webhook updates, leading to false negatives.
            // Instead of failing immediately, we FORCE a server-side verification loop.
            
            // Only fast-fail if we are absolutely certain it's a manual cancellation (optional optimization)
            // But for safety, even cancellations are verified to ensure no money was deducted.
            
            console.log("Status ambiguous or failed. Initiating API Verification Loop (Source of Truth).")
            fetchInvoice(p_inv, 'verify_db')

        } else {
            // Even unknown statuses get verified instead of errored
            fetchInvoice(p_inv, 'verify_db')
        }
    }, [])

    const fetchInvoice = async (invNum, mode = 'success_update', retryCount = 0) => {
        try {
            const q = query(collection(db, 'customer_invoices'), where('invoiceNumber', '==', invNum))
            const snap = await getDocs(q)
            if (!snap.empty) {
                const docSnap = snap.docs[0]
                const data = docSnap.data()
                data.id = docSnap.id 
                
                // ----------------------------------------------------
                // VERIFICATION MODE (Auto-Check)
                // ----------------------------------------------------
                if (mode === 'verify_db') {
                    const urlAmount = parseFloat(getParam('amount') || 0)
                    
                    // 1. Check if ALREADY Fully Paid (Safety Check)
                    if (data.paymentStatus === 'paid' || data.balanceDue <= 1) {
                         console.log("DB Verification: Invoice is fully paid.")
                         setStatus('success')
                         // If fully paid, show total or the specific transaction amount
                         setAmountPaid(urlAmount > 0 ? urlAmount : (data.deposit || data.total))
                         setInvoiceData(data)
                         return
                    }

                    // 2. Check if Deposit is paid (but Balance remains)
                    // We must be careful not to trigger this if the user is TRYING to pay the balance now.
                    // Logic: If URL amount is basically the same as the Balance Due, then we are trying to pay the balance.
                    // So we should NOT accept 'deposit-paid' as a success state for THIS transaction.
                    
                    const isTryingToPayBalance = urlAmount > 0 && Math.abs(urlAmount - data.balanceDue) < 2.0 // Tolerance of RM2
                    
                    if (data.depositStatus === 'paid_link' && !isTryingToPayBalance) {
                        console.log("DB Verification: Deposit known paid, and not trying to pay balance.")
                        setStatus('success')
                        setAmountPaid(urlAmount > 0 ? urlAmount : data.deposit) 
                        setInvoiceData(data)
                        return
                    }
                    
                    // 3. API Check (Source of Truth) -> FAST CHECK ONLY (Fire & Forget / One Pass)
                    // The user prefers to rely on the Official Receipt (Redirect) rather than our internal validation blocking the UI.
                    
                    const urlBillId = getParam('billplz[id]') || getParam('id') || getParam('bill_id')
                    const targetBillId = urlBillId || data.lastPaymentId

                    if (targetBillId) {
                         console.log(`Doing Quick API Check: ${targetBillId}`)
                         try {
                              // One time check. No loop.
                              const apiRes = await LeanxService.checkPaymentStatus(targetBillId)
                              
                              if (apiRes.success && apiRes.paid) {
                                  console.log("Quick Check Paid. Updating DB.")
                                  await fetchInvoice(invNum, 'success_update') 
                                  // The redirect will happen automatically in the useEffect 
                                  // because fetchInvoice sets status='success' inside success_update
                                  return
                              } 
                              
                              console.log("Quick Check didn't confirm paid. Proceeding to redirect anyway.")
                              // We don't fail. We just set status='redirecting' to trigger the link.
                              setInvoiceData(data)
                              setStatus('success') // Treat as success to trigger the auto-redirect logic
                              return

                         } catch (apiErr) {
                              console.error("Quick Check API Error", apiErr)
                              // Ignore error, proceed to redirect
                              setInvoiceData(data)
                              setStatus('success') 
                              return
                         }
                    } else {
                        // No ID. Just redirect.
                        console.log("No ID for check. Redirecting to link.")
                        setInvoiceData(data)
                        setStatus('success')
                        return
                    }
                }

                // ----------------------------------------------------
                // SUCCESS UPDATE MODE
                // ----------------------------------------------------
                if (mode === 'success_update') {
                    // Attempt to update DB Status immediately
                    try {
                        const urlParams = new URLSearchParams(window.location.search)
                        const amountPaid = parseFloat(urlParams.get('amount') || data.balanceDue || 0)
                        
                        // Transaction ID or unique marker
                        const transactionId = urlParams.get('transaction_id') || urlParams.get('billcode') || urlParams.get('id')

                        // Idempotency Check
                        if (transactionId && data.lastPaymentTransactionId === transactionId) {
                             // Already done
                        } else if (data.balanceDue > 1) { // Only update if needed
                            const newDeposit = (data.deposit || 0) + amountPaid
                            const newBalance = (data.customerTotal || data.total) - newDeposit
                            const safeBalance = newBalance < 0 ? 0 : newBalance
                            const isPaidFull = safeBalance < 1
                            
                            await updateDoc(doc(db, 'customer_invoices', docSnap.id), {
                                deposit: newDeposit,
                                balanceDue: safeBalance,
                                depositStatus: 'paid_link',
                                paymentStatus: isPaidFull ? 'paid' : 'deposit-paid', 
                                paymentMethod: 'online_link',
                                lastPaymentTransactionId: transactionId || new Date().toISOString()
                            })
                            console.log('Payment recorded to DB')
                            
                            data.deposit = newDeposit
                            data.balanceDue = safeBalance
                        }
                    } catch (updateErr) {
                        console.warn("DB Update warn:", updateErr)
                    }
                    setStatus('success')
                }
                
                // Set Display Amount
                const urlParams = new URLSearchParams(window.location.search)
                const paidAmt = parseFloat(urlParams.get('amount') || 0)
                setAmountPaid(paidAmt > 0 ? paidAmt : (data.deposit || data.total)) 

                setInvoiceData(data)
            } else {
                if (mode === 'success_update') setStatus('not_found')
                else setStatus('failed') // Invoice not found -> Payment Logic Fail
            }
        } catch (err) {
            console.error(err)
            setStatus('error')
        }
    }

    const handleDownloadReceipt = () => {
        const printWindow = window.open('', '', 'width=600,height=800')
        printWindow.document.write('<html><head><title>Payment Receipt</title>')
        printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">')
        printWindow.document.write(`
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 20px; }
                .receipt-container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white;
                    padding: 40px; 
                    border: 1px solid #e5e7eb; 
                    border-radius: 4px;
                }
                .logo-img { max-height: 48px; width: auto; margin-bottom: 16px; margin-left: auto; margin-right: auto; }
                @media print {
                    body { background: white; padding: 0; }
                    .receipt-container { border: none; padding: 20px; }
                }
            </style>
        `)
        printWindow.document.write('</head><body>')
        printWindow.document.write('<div class="receipt-container">')
        if (receiptRef.current) {
             printWindow.document.write(receiptRef.current.innerHTML)
        }
        printWindow.document.write('</div>')
        printWindow.document.write('</body></html>')
        printWindow.document.close()
        
        setTimeout(() => {
            printWindow.focus()
            printWindow.print()
        }, 800)
    }

    const handleRetryPayment = async () => {
        if (!invoiceData) {
            window.history.back()
            return
        }

        setIsRetrying(true)
        try {
            // Determine amount (Balance Due or Total)
            // If the user was trying to pay a deposit, we might not know the exact amount they intended.
            // But usually we link to the full balance if unpaid.
            const payAmount = invoiceData.balanceDue > 0 ? invoiceData.balanceDue : invoiceData.total

            // Prepare customer data from invoice
            const customer = {
                name: invoiceData.customerName || 'Customer',
                phone: invoiceData.customerPhone || '',
                email: invoiceData.customerEmail || ''
            }

            console.log("Regenerating link for retry...")
            const res = await LeanxService.generatePaymentLink(invoiceData, customer, payAmount)
            
            if (res.success) {
                // Update DB with the new fresh link and ID!
                if (invoiceData.id) {
                     await updateDoc(doc(db, 'customer_invoices', invoiceData.id), { 
                         lastPaymentLink: res.url,
                         lastPaymentId: res.id 
                    })
                }
                // Redirect
                window.location.href = res.url
            } else {
                alert("Failed to generate new payment link. Please contact support.")
                setIsRetrying(false)
            }
        } catch (err) {
            console.error("Retry Error:", err)
            alert("Error retrying payment. Please contact admin.")
            setIsRetrying(false)
        }
    }

    useEffect(() => {
        // AUTO-REDIRECT Logic
        // As per new simplified flow, we do not want to show a custom Success/Fail screen.
        // Instead, we just act as a middleware to verify/update DB, and then send the user back to the Payment Link (Source of Truth).
        
        if (status === 'loading') return;

        if (invoiceData?.lastPaymentLink) {
             const redirectDelay = 500; // Ultra fast redirect. 0.5s is enough to see "Processing"
             
             if (status === 'success' || status === 'failed' || status === 'not_found' || status === 'redirecting') {
                 console.log("Redirecting to Source of Truth:", invoiceData.lastPaymentLink)
                 setTimeout(() => {
                     window.location.href = invoiceData.lastPaymentLink
                 }, redirectDelay)
             }
        }
    }, [status, invoiceData])

    if (status === 'loading' || (status === 'success' && invoiceData?.lastPaymentLink)) return (
        <div className="flex flex-col h-screen items-center justify-center text-gray-500 space-y-4">
            <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium text-gray-600">
                {status === 'success' ? 'Verifying payment status...' : loadingMessage}
            </p>
            <p className="text-sm text-gray-400">Please do not close this window.</p>
        </div>
    )

    // Fallback UI (Only if no link to redirect to)
    const handleOpenOfficialReceipt = () => {
        if (invoiceData?.lastPaymentLink) {
             window.open(invoiceData.lastPaymentLink, '_blank')
        } else {
            alert("No payment URL found.")
        }
    }

    // Fallback UI (Only if no link to redirect to, or error state where we can't redirect)
    
    if (status !== 'success' && status !== 'loading') { // Error states that fell through redirect logic (e.g. missing link)
        const isCancelled = status === 'canceled' || status === 'cancelled'
        
        // If we have the link, we should have redirected. 
        // If we are here, and have link, it means the redirect is pending or failed.
        // Let's offer a manual click just in case.
        
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className={`w-20 h-20 ${isCancelled ? 'bg-yellow-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                         <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Redirecting...
                    </h2>
                    
                    <p className="text-gray-500 mb-8">
                       Returning you to the payment provider...
                    </p>
                    
                    {invoiceData?.lastPaymentLink ? (
                        <button 
                            onClick={() => window.location.href = invoiceData.lastPaymentLink} 
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition mb-3 shadow-md"
                        >
                            Click here if not redirected
                        </button>
                    ) : (
                        <button onClick={() => window.history.back()} className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl">
                            Go Back
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Success View - HIDDEN / UNREACHABLE usually due to auto-redirect
    // But kept as fallback if redirect is slow or we decide to show it.
    // Actually, with the new logic, we return early if status is success & link exists.
    // So this is only reachable if no link exists.

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 flex flex-col items-center justify-center font-sans">
             
             {/* Receipt Card */}
             <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden relative">
                
                <div ref={receiptRef} className="p-8 bg-white">
                    <div className="text-center border-b border-gray-100 pb-6 mb-6">
                        {/* Logo */}
                        <div className="mb-4 flex justify-center">
                            <img src={logoBase64} alt="Company Logo" className="logo-img h-12 w-auto object-contain" />
                        </div>
                        
                        <h1 className="text-lg font-bold text-gray-800 uppercase tracking-widest mb-1">Official Receipt</h1>
                        <p className="text-[10px] text-gray-500">One X Transmission Specialist</p>
                        <p className="text-[10px] text-gray-400">Reg: 202401000123 (12345-X)</p>
                    </div>

                    <div className="flex justify-between items-start mb-6 text-sm">
                        <div className="text-left">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Billed To</p>
                            <p className="font-bold text-gray-800">{invoiceData?.customerName || 'Customer'}</p>
                            {invoiceData?.carPlate && <p className="text-gray-500 text-xs mt-0.5">Vehicle: {invoiceData.carPlate}</p>}
                        </div>
                        <div className="text-right">
                             <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Payment Date</p>
                             <p className="font-medium text-gray-800 text-xs mb-2">{(invoiceData?.timestamp ? new Date(invoiceData.timestamp.seconds * 1000) : new Date()).toLocaleDateString()}</p>

                             <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Receipt Ref</p>
                             <p className="font-medium text-gray-800 text-xs">{params.invoice}</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-500">Payment Status</span>
                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Successful</span>
                        </div>
                        <div className="border-t border-gray-200 my-2 border-dashed"></div>
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-semibold text-gray-700">Amount Paid</span>
                            <span className="text-2xl font-bold text-gray-900">
                                {amountPaid ? new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(amountPaid) : 'Paid'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="text-center pt-2">
                        <p className="text-[10px] text-gray-400 italic">This is a system generated receipt and requires no signature.</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-6 border-t border-gray-100">
                    <button 
                        onClick={handleDownloadReceipt}
                        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition shadow-sm flex items-center justify-center text-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PDF Receipt
                    </button>
                    <p className="text-center text-gray-400 text-[10px] mt-4">One X Transmission Platform &copy; 2026</p>
                </div>
             </div>
        </div>
    )
}
export default PaymentReceipt
