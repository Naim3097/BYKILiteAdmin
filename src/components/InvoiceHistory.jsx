import { useState } from 'react'
import { useInvoiceContext } from '../context/InvoiceContext'
import { usePartsContext } from '../context/PartsContext'
import InvoicePreview from './InvoicePreview'
import SimpleEditInvoiceModal from './SimpleEditInvoiceModal'
import PDFGenerator from '../utils/PDFGenerator'

function InvoiceHistory() {
  
  const { 
    invoices, 
    searchInvoices, 
    calculateInvoiceStats, 
    loading, 
    error, 
    deleteInvoice
  } = useInvoiceContext()
  const { parts } = usePartsContext()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null)
  
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  })

  const displayedInvoices = searchInvoices(searchQuery)
  const stats = calculateInvoiceStats()

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && invoices.length === 0) {
    return (
      <div className="touch-spacing">
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner mr-3"></div>
            <span className="text-black-75">Loading invoices...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="touch-spacing">
        <div className="card border-primary-red bg-red-50">
          <div className="text-center py-8">
            <div className="text-primary-red mb-2">Connection Error</div>
            <p className="text-black-75 text-sm">
              Unable to connect to cloud database. Using local data.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const filteredByDate = dateFilter.startDate && dateFilter.endDate
    ? displayedInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.dateCreated)
        return invoiceDate >= new Date(dateFilter.startDate) && 
               invoiceDate <= new Date(dateFilter.endDate + 'T23:59:59')
      })
    : displayedInvoices

  // Handle invoice deletion
  const handleDeleteInvoice = async (invoice) => {
    const confirmMessage = `Are you sure you want to delete invoice ${invoice.invoiceNumber}?\n\nThis will:\n- Remove the invoice permanently\n- Restore stock for all items\n- Cannot be undone\n\nTotal: RM ${invoice.totalAmount.toFixed(2)}`
    
    if (!window.confirm(confirmMessage)) return

    setDeletingInvoiceId(invoice.id)
    try {
      const result = await deleteInvoice(invoice.id, parts)
      if (result.success) {
        alert(`Invoice ${invoice.invoiceNumber} deleted successfully!\n\nStock has been restored for all items.`)
      } else {
        alert(`Failed to delete invoice: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert(`Error deleting invoice: ${error.message}`)
    } finally {
      setDeletingInvoiceId(null)
    }
  }

  // Download PDF
  const downloadPDF = (invoice) => {
    PDFGenerator.generateInvoicePDF(invoice)
  }

  // Handle edit button click
  const handleEditClick = (invoice) => {
    setEditingInvoice(invoice)
  }

  // Handle edit success
  const handleEditSuccess = (updatedInvoice) => {
    setEditingInvoice(null)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="section-title">Invoice History</h2>
          <p className="text-black-75 text-body">
            View and manage all generated invoices ({invoices.length} total)
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-small text-black-75">Total Invoices</div>
          <div className="text-2xl font-bold text-primary-black">{stats.totalInvoices}</div>
        </div>
        <div className="card">
          <div className="text-small text-black-75">Total Revenue</div>
          <div className="text-2xl font-bold text-primary-red">RM{stats.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="text-small text-black-75">Average Invoice</div>
          <div className="text-2xl font-bold text-primary-black">RM{stats.averageInvoiceValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by invoice number, customer name, or part code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFilter.startDate}
            onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
            className="input-field"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={dateFilter.endDate}
            onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
            className="input-field"
            placeholder="End Date"
          />
          <button
            onClick={() => setDateFilter({startDate: '', endDate: ''})}
            className="btn-tertiary whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        {filteredByDate.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-black-50 text-body mb-4">
              {invoices.length === 0 
                ? "No invoices generated yet." 
                : "No invoices found matching your search criteria."
              }
            </div>
            {invoices.length === 0 && (
              <p className="text-small text-black-75">
                Start by creating your first invoice in the Invoice Generation section.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View — < md */}
            <div className="md:hidden space-y-3 p-3">
              {filteredByDate
                .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
                .map((invoice) => (
                  <div
                    key={invoice.id}
                    className="bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-black-10">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-primary-black break-words">
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-xs text-black-75 mt-0.5">
                          {formatDate(invoice.dateCreated)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary-red text-base">
                          RM{invoice.totalAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-black-75">
                          {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm mb-2">
                      <div className="text-black-50 text-xs">Customer</div>
                      <div className="text-primary-black break-words">
                        {invoice.customerInfo?.name || 'Walk-in Customer'}
                      </div>
                      {invoice.customerInfo?.phone && (
                        <div className="text-xs text-black-75">{invoice.customerInfo.phone}</div>
                      )}
                    </div>

                    {invoice.items.length > 0 && (
                      <div className="text-xs text-black-75 mb-3 break-words">
                        {invoice.items.slice(0, 2).map((item) => item.kodProduk).join(', ')}
                        {invoice.items.length > 2 && ` +${invoice.items.length - 2} more`}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black-10">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="btn-tertiary text-sm py-2 min-h-touch"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditClick(invoice)}
                        className="btn-secondary text-sm py-2 min-h-touch"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => downloadPDF(invoice)}
                        className="btn-tertiary text-sm py-2 min-h-touch"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => handleDeleteInvoice(invoice)}
                        disabled={deletingInvoiceId === invoice.id}
                        className="btn-danger text-sm py-2 min-h-touch"
                      >
                        {deletingInvoiceId === invoice.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop Table View — md+ */}
            <div className="hidden md:block overflow-x-auto touch-scroll">
              <table className="w-full">
              <thead>
                <tr className="border-b border-black-10">
                  <th className="table-header text-left">Invoice Number</th>
                  <th className="table-header text-left">Date</th>
                  <th className="table-header text-left">Customer</th>
                  <th className="table-header text-left">Items</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredByDate
                  .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
                  .map((invoice) => (
                    <tr key={invoice.id} className="border-b border-black-10 hover:bg-black-10 transition-colors">
                      <td className="table-cell">
                        <div className="font-semibold">{invoice.invoiceNumber}</div>
                      </td>
                      <td className="table-cell">
                        <div className="text-small">{formatDate(invoice.dateCreated)}</div>
                      </td>
                      <td className="table-cell">
                        <div>
                          {invoice.customerInfo?.name || 'Walk-in Customer'}
                        </div>
                        {invoice.customerInfo?.phone && (
                          <div className="text-small text-black-75">
                            {invoice.customerInfo.phone}
                          </div>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="text-small">
                          {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-small text-black-75">
                          {invoice.items.slice(0, 2).map(item => item.kodProduk).join(', ')}
                          {invoice.items.length > 2 && ` +${invoice.items.length - 2} more`}
                        </div>
                      </td>
                      <td className="table-cell text-right">
                        <div className="font-semibold text-primary-red">
                          RM{invoice.totalAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedInvoice(invoice)}
                            className="btn-tertiary text-small py-1 px-3 min-h-[44px] sm:min-h-auto"
                            title="View invoice details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditClick(invoice)}
                            className="btn-secondary text-small py-1 px-3 min-h-[44px] sm:min-h-auto"
                            title="Edit invoice and adjust stock"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => downloadPDF(invoice)}
                            className="btn-tertiary text-small py-1 px-3 min-h-[44px] sm:min-h-auto"
                            title="Download PDF"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="btn-danger text-small py-1 px-3 min-h-[44px] sm:min-h-auto"
                            disabled={deletingInvoiceId === invoice.id}
                            title="Delete invoice and restore stock"
                          >
                            {deletingInvoiceId === invoice.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Show total count */}
      {filteredByDate.length > 0 && (
        <div className="text-center text-small text-black-75">
          Showing {filteredByDate.length} of {invoices.length} invoices
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoicePreview
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          isViewMode={true}
        />
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <SimpleEditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

export default InvoiceHistory
