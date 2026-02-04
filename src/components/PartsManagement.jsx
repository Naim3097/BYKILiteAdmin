import { useState } from 'react'
import { usePartsContext } from '../context/PartsContext'
import AddPartForm from './AddPartForm'
import EditPartModal from './EditPartModal'

function PartsManagement() {
  const { parts, searchParts, getLowStockParts, deletePart, loading, error, retryConnection, isRetrying } = usePartsContext()
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingPart, setEditingPart] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'low_stock'

  // Filter Logic
  let displayedParts = searchParts(searchQuery)
  if (activeFilter === 'low_stock') {
    displayedParts = displayedParts.filter(p => p.unitStock <= 10) // 10 is typical threshold, or use context helper
  }

  // Stats
  const totalItems = parts.length
  const lowStockCount = parts.filter(p => p.unitStock <= 10).length
  const totalValue = parts.reduce((sum, part) => sum + ((parseFloat(part.harga) || 0) * (parseInt(part.unitStock) || 0)), 0)

  // Helpers
  const formatCurrency = (val) => new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(val || 0)
  
  const handleDelete = async (part) => {
     if (window.confirm(`Are you sure you want to permanently delete "${part.namaProduk}"?`)) {
        try {
           await deletePart(part.id)
        } catch(e) {
           alert("Failed to delete part.")
        }
     }
  }

  // Stock Status Badge
  const StockBadge = ({ stock }) => {
     if (stock <= 0) return <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full uppercase">Out of Stock</span>
     if (stock <= 10) return <span className="px-2 py-1 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full uppercase">Low Stock</span>
     return <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full uppercase">In Stock</span>
  }

  if (loading && parts.length === 0 && !isRetrying) {
     return <div className="p-8 text-center text-gray-500">Loading inventory data...</div>
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         
         {/* Total Products */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Products</p>
               <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalItems}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
         </div>

         {/* Inventory Value */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Value</p>
               <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalValue)}</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-full">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
         </div>

         {/* Low Stock Alert */}
         <div className={`p-6 rounded-xl border shadow-sm flex items-center justify-between cursor-pointer transition-all ${activeFilter === 'low_stock' ? 'bg-red-50 border-red-200 ring-2 ring-red-500' : 'bg-white border-gray-100 hover:border-red-200'}`} onClick={() => setActiveFilter(activeFilter === 'low_stock' ? 'all' : 'low_stock')}>
            <div>
               <p className={`text-xs font-bold uppercase tracking-wider ${activeFilter === 'low_stock' ? 'text-red-700' : 'text-gray-500'}`}>Low Stock Alert</p>
               <h3 className={`text-2xl font-bold mt-1 ${activeFilter === 'low_stock' ? 'text-red-700' : 'text-gray-900'}`}>{lowStockCount}</h3>
               <p className="text-xs text-red-500 mt-1 font-medium">Items need reorder</p>
            </div>
            <div className={`p-3 rounded-full ${activeFilter === 'low_stock' ? 'bg-red-200 text-red-700' : 'bg-red-50 text-red-600'}`}>
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
         </div>
      </div>

      {/* Main Content */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
         
         {/* Toolbar */}
         <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
            <div className="relative w-full md:w-96">
               <input 
                 type="text" 
                 placeholder="Search parts by name, code..." 
                 className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
               <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button 
               onClick={() => setShowAddForm(true)}
               className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
               Add New Part
            </button>
         </div>

         {/* Table */}
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                  <tr>
                     <th className="px-6 py-4">Product Info</th>
                     <th className="px-6 py-4">Category/Code</th>
                     <th className="px-6 py-4 text-center">Stock Level</th>
                     <th className="px-6 py-4 text-right">Price (RM)</th>
                     <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {displayedParts.length > 0 ? displayedParts.map(part => (
                     <tr key={part.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                 {part.gambar ? <img src={part.gambar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
                              </div>
                              <div className="min-w-0">
                                 <p className="font-bold text-gray-900 truncate max-w-[200px]">{part.namaProduk}</p>
                                 <p className="text-xs text-gray-500 truncate">{part.supplier || 'No Supplier'}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs font-mono font-medium">{part.kodProduk}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <StockBadge stock={part.unitStock} />
                           <p className="text-xs text-gray-400 mt-1">{part.unitStock} units</p>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                           {formatCurrency(part.harga)}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingPart(part)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <button onClick={() => handleDelete(part)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                           </div>
                        </td>
                     </tr>
                  )) : (
                     <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                           {searchQuery ? 'No parts found matching your search.' : 'No parts in inventory. Click "Add New Part" to start.'}
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Modals */}
      {showAddForm && (
         <AddPartForm onClose={() => setShowAddForm(false)} />
      )}
      
      {editingPart && (
         <EditPartModal part={editingPart} onClose={() => setEditingPart(null)} />
      )}
    </div>
  )
}

export default PartsManagement
