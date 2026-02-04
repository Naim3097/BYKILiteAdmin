import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebaseConfig'

function MechanicCommissionDashboard() {
  const [mechanicCommissions, setMechanicCommissions] = useState([])
  const [selectedTimeframe, setSelectedTimeframe] = useState('month')
  const [selectedMechanic, setSelectedMechanic] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [mechanicList, setMechanicList] = useState([])
  const [commissionDetails, setCommissionDetails] = useState([])
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadMechanicCommissions()
  }, [selectedTimeframe, selectedMechanic])

  const loadMechanicCommissions = async () => {
    setIsLoading(true)
    
    try {
      // Get date range based on timeframe
      const { startDate, endDate } = getDateRange(selectedTimeframe)
      
      // Query customer_invoices - load all and filter by date in JavaScript
      // (Firestore Timestamp comparison can be tricky, so we filter client-side)
      const invoicesRef = collection(db, 'customer_invoices')
      const invoicesQuery = query(
        invoicesRef,
        orderBy('dateCreated', 'desc')
      )

      const invoicesSnapshot = await getDocs(invoicesQuery)
      const allInvoices = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateCreated: doc.data().dateCreated?.toDate?.() || new Date(doc.data().dateCreated)
      }))
      
      // Filter by date range
      const invoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.dateCreated)
        return invoiceDate >= startDate && invoiceDate <= endDate
      })

      console.log('📊 Loaded invoices for commission calculation:', invoices.length)

      // Group invoices by mechanic and calculate commissions
      const mechanicData = await calculateMechanicCommissions(invoices)
      
      // Get unique mechanic list from invoices
      const mechanics = [...new Set(invoices.map(invoice => invoice.mechanicName).filter(Boolean))]
      setMechanicList(mechanics)
      
      // Filter by selected mechanic if not 'all'
      const filteredData = selectedMechanic === 'all' 
        ? mechanicData 
        : mechanicData.filter(mechanic => mechanic.name === selectedMechanic)
      
      setMechanicCommissions(filteredData)
      
    } catch (error) {
      console.error('❌ Error loading mechanic commissions:', error)
    }
    
    setIsLoading(false)
  }

  const calculateMechanicCommissions = async (invoices) => {
    // Group invoices by mechanic
    const mechanicGroups = {}
    
    invoices.forEach(invoice => {
      // ----------------------------------------------------------------
      // STRATEGY 1: NEW "Commission 2.0" Format (Array of Mechanics)
      // ----------------------------------------------------------------
      if (invoice.mechanics && Array.isArray(invoice.mechanics) && invoice.mechanics.length > 0) {
          invoice.mechanics.forEach(m => {
              const mechanicName = m.name || 'Unknown'
              const mechanicId = m.id || 'unknown'
              const memberCommission = Number(m.commissionAmount) || 0
              
              if (!mechanicGroups[mechanicName]) {
                  mechanicGroups[mechanicName] = {
                      id: mechanicId,
                      name: mechanicName,
                      invoices: [],
                      totalRevenue: 0,
                      totalCommission: 0,
                      paidCommission: 0,
                      pendingCommission: 0,
                      invoiceCount: 0,
                      paidInvoices: 0,
                      pendingInvoices: 0,
                      individualCommissions: 0,
                      teamCommissions: 0, // Not really relevant in 2.0, but keep for structure
                      totalPartsRevenue: 0,
                      totalLabour: 0,
                      teamInvoices: 0
                  }
              }

              // In 2.0, "Revenue" per mechanic is ambiguous if shared. 
              // We can attribute FULL revenue to everyone (double counting?) or split it.
              // For simplicity, we attribute the full invoice revenue to the mechanic's record 
              // so they see "I worked on update of RM5000 job". 
              // But for TOTAL summaries, this might double count.
              // Dashboard usually shows "My Performance".
              
              mechanicGroups[mechanicName].invoices.push({
                  ...invoice,
                  memberCommission,
                  isTeamInvoice: invoice.mechanics.length > 1
              })

              mechanicGroups[mechanicName].totalCommission += memberCommission
              mechanicGroups[mechanicName].individualCommissions += memberCommission // Treat all as individual/earned
              
              // Only count revenue once per invoice? No, mechanics usually want to see "Total Job Value"
              // But for "Total Revenue" of shop, this is bad. 
              // BUT this is "Mechanic Commission Dashboard", not "Shop Revenue".
              // Let's stick to full invoice value association.
              mechanicGroups[mechanicName].totalRevenue += (invoice.total || 0)
              
              mechanicGroups[mechanicName].invoiceCount += 1
              if (invoice.mechanics.length > 1) mechanicGroups[mechanicName].teamInvoices += 1

              if (invoice.paymentStatus === 'paid') {
                  mechanicGroups[mechanicName].paidInvoices += 1
                  mechanicGroups[mechanicName].paidCommission += memberCommission
              } else {
                  mechanicGroups[mechanicName].pendingInvoices += 1
                  mechanicGroups[mechanicName].pendingCommission += memberCommission
              }
          })
          return; // Done with this invoice
      }

      // ----------------------------------------------------------------
      // STRATEGY 2: Legacy Formats
      // ----------------------------------------------------------------
      const commissionAmount = invoice.commissionAmount || 0
      const distributionType = invoice.commissionDistributionType || 'individual'
      
      if (distributionType === 'team' && invoice.commissionDistribution?.teamMembers) {
        // Handle team distribution - split commission among team members
        invoice.commissionDistribution.teamMembers.forEach(member => {
          const mechanicName = member.mechanicName || 'Unknown'
          const mechanicId = member.mechanicId || 'unknown'
          const memberCommission = (commissionAmount * member.percentage) / 100
          
          if (!mechanicGroups[mechanicName]) {
            mechanicGroups[mechanicName] = {
              id: mechanicId,
              name: mechanicName,
              invoices: [],
              totalRevenue: 0,
              totalCommission: 0,
              paidCommission: 0,
              pendingCommission: 0,
              invoiceCount: 0,
              paidInvoices: 0,
              pendingInvoices: 0,
              individualCommissions: 0,
              teamCommissions: 0,
              totalPartsRevenue: 0,
              totalLabour: 0,
              teamInvoices: 0
            }
          }
          
          mechanicGroups[mechanicName].invoices.push({
            ...invoice,
            memberCommission,
            memberPercentage: member.percentage,
            isTeamInvoice: true
          })
          
          // Calculate proportional parts revenue and labour
          const proportionalPartsRevenue = (invoice.partsRevenue || 0) * (member.percentage / 100)
          const proportionalLabour = (invoice.totalLabour || 0) * (member.percentage / 100)
          
          mechanicGroups[mechanicName].totalRevenue += (invoice.total || 0) * (member.percentage / 100)
          mechanicGroups[mechanicName].totalCommission += memberCommission
          mechanicGroups[mechanicName].teamCommissions += memberCommission
          mechanicGroups[mechanicName].totalPartsRevenue += proportionalPartsRevenue
          mechanicGroups[mechanicName].totalLabour += proportionalLabour
          mechanicGroups[mechanicName].teamInvoices += 1
          mechanicGroups[mechanicName].invoiceCount += 1
          
          // Track payment status and separate paid/pending commissions
          if (invoice.paymentStatus === 'paid') {
            mechanicGroups[mechanicName].paidInvoices += 1
            mechanicGroups[mechanicName].paidCommission += memberCommission
          } else {
            mechanicGroups[mechanicName].pendingInvoices += 1
            mechanicGroups[mechanicName].pendingCommission += memberCommission
          }
        })
      } else {
        // Handle individual distribution (original logic)
        const mechanicName = invoice.mechanicName || 'Unknown'
        // Skip if no mechanic name and no mechanics array (Zombie invoice)
        if (!invoice.mechanicName && !invoice.mechanics) return;

        const mechanicId = invoice.mechanicId || 'unknown'
        
        if (!mechanicGroups[mechanicName]) {
          mechanicGroups[mechanicName] = {
            id: mechanicId,
            name: mechanicName,
            invoices: [],
            totalRevenue: 0,
            totalCommission: 0,
            paidCommission: 0,
            pendingCommission: 0,
            invoiceCount: 0,
            paidInvoices: 0,
            pendingInvoices: 0,
            individualCommissions: 0,
            teamCommissions: 0,
            totalPartsRevenue: 0,
            totalLabour: 0,
            teamInvoices: 0
          }
        }
        
        mechanicGroups[mechanicName].invoices.push({
          ...invoice,
          isTeamInvoice: false
        })
        mechanicGroups[mechanicName].totalRevenue += invoice.total || 0
        mechanicGroups[mechanicName].totalCommission += commissionAmount
        mechanicGroups[mechanicName].individualCommissions += commissionAmount
        mechanicGroups[mechanicName].totalPartsRevenue += invoice.partsRevenue || 0
        mechanicGroups[mechanicName].totalLabour += invoice.totalLabour || 0
        mechanicGroups[mechanicName].invoiceCount += 1
        
        // Track payment status and separate paid/pending commissions
        if (invoice.paymentStatus === 'paid') {
          mechanicGroups[mechanicName].paidInvoices += 1
          mechanicGroups[mechanicName].paidCommission += commissionAmount
        } else {
          mechanicGroups[mechanicName].pendingInvoices += 1
          mechanicGroups[mechanicName].pendingCommission += commissionAmount
        }
      }
    })

    console.log("Calculated Groups:", mechanicGroups)
    return Object.values(mechanicGroups)
  }

  const getDateRange = (timeframe) => {
    const now = new Date()
    let startDate, endDate = new Date()

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3
        startDate = new Date(now.getFullYear(), quarterStart, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    return { startDate, endDate }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ms-MY', {
      style: 'currency',
      currency: 'MYR'
    }).format(amount || 0)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const showMechanicDetails = (mechanic) => {
    setCommissionDetails(mechanic.invoices)
    setShowDetails(true)
  }

  const getTotalCommissions = () => {
    return mechanicCommissions.reduce((sum, mechanic) => sum + mechanic.totalCommission, 0)
  }

  const getPaidCommissions = () => {
    return mechanicCommissions.reduce((sum, mechanic) => sum + mechanic.paidCommission, 0)
  }

  const getPendingCommissions = () => {
    return mechanicCommissions.reduce((sum, mechanic) => sum + mechanic.pendingCommission, 0)
  }

  const getTotalRevenue = () => {
    return mechanicCommissions.reduce((sum, mechanic) => sum + mechanic.totalRevenue, 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
        <span className="ml-3 text-black-75">Loading commission data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary-black">Mechanic Commissions</h2>
          <p className="text-black-75 text-sm sm:text-base">
            Track and analyze mechanic performance and earnings
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 border border-black-25 rounded-lg focus:ring-2 focus:ring-primary-red focus:border-primary-red"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          
          <select
            value={selectedMechanic}
            onChange={(e) => setSelectedMechanic(e.target.value)}
            className="px-3 py-2 border border-black-25 rounded-lg focus:ring-2 focus:ring-primary-red focus:border-primary-red"
          >
            <option value="all">All Mechanics</option>
            {mechanicList.map(mechanic => (
              <option key={mechanic} value={mechanic}>{mechanic}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Paid Commissions */}
        <div className="bg-primary-white rounded-lg border border-black-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-black-50 text-sm uppercase tracking-wide">Total Commissions</p>
              <p className="text-3xl font-bold text-primary-red">
                {formatCurrency(getPaidCommissions())}
              </p>
            </div>
            <div className="p-3 bg-red-10 rounded-full">
              <svg className="w-6 h-6 text-primary-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-primary-white rounded-lg border border-black-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-black-50 text-sm uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-primary-black">
                {formatCurrency(getTotalRevenue())}
              </p>
            </div>
            <div className="p-3 bg-black-10 rounded-full">
              <svg className="w-6 h-6 text-primary-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active Mechanics */}
        <div className="bg-primary-white rounded-lg border border-black-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-black-50 text-sm uppercase tracking-wide">Active Mechanics</p>
              <p className="text-2xl font-bold text-primary-black">
                {mechanicCommissions.length}
              </p>
            </div>
            <div className="p-3 bg-red-10 rounded-full">
              <svg className="w-6 h-6 text-primary-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Mechanic Commission Table */}
      <div className="bg-primary-white rounded-lg border border-black-10 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-black-10">
          <h3 className="text-lg font-semibold text-primary-black">Commission Breakdown</h3>
        </div>
        
        {mechanicCommissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black-10">
              <thead className="bg-black-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Mechanic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Invoices</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Commission Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Parts Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Total Commission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black-75 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black-10">
                {mechanicCommissions.map((mechanic, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-primary-black">{mechanic.name}</div>
                      <div className="text-xs text-black-50">{mechanic.invoiceCount} jobs completed</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-black">
                      <div>{mechanic.invoiceCount} total</div>
                      <div className="text-xs text-green-600">{mechanic.paidInvoices} paid</div>
                      <div className="text-xs text-yellow-600">{mechanic.pendingInvoices} pending</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-black">
                      <div className="flex flex-col gap-1">
                        {mechanic.individualCommissions > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            👤 Individual: {formatCurrency(mechanic.individualCommissions)}
                          </span>
                        )}
                        {mechanic.teamCommissions > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                            👥 Team: {formatCurrency(mechanic.teamCommissions)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-black">
                      <div>{formatCurrency(mechanic.totalPartsRevenue || 0)}</div>
                      <div className="text-xs text-black-50">+ Labour: {formatCurrency(mechanic.totalLabour || 0)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xl font-bold text-primary-red">
                        {formatCurrency(mechanic.totalCommission)}
                      </div>
                      <div className="text-xs text-black-50 mt-1">
                        Paid: {formatCurrency(mechanic.paidCommission)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => showMechanicDetails(mechanic)}
                        className="text-primary-red hover:text-red-dark"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-black-50">No commission data found for the selected period.</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Commission Details</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black-10">
                <thead className="bg-black-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Commission Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black-75 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black-10">
                  {commissionDetails.map((invoice, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{formatDate(invoice.dateCreated?.toDate?.() || invoice.dateCreated)}</td>
                      <td className="px-4 py-3 text-sm font-mono">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 text-sm">{invoice.customerName || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(invoice.total)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="capitalize">{invoice.commissionType || 'N/A'}</span>
                        {invoice.commissionType === 'percentage' && ` (${invoice.commissionValue}%)`}
                        {invoice.commissionType === 'fixed' && ` (${formatCurrency(invoice.commissionValue)})`}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary-red">{formatCurrency(invoice.commissionAmount || 0)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : invoice.paymentStatus === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.paymentStatus || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-black-25 text-primary-black rounded-lg hover:bg-black-50"
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

export default MechanicCommissionDashboard