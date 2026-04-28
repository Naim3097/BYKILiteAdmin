import React from 'react'

/**
 * ResponsiveTable
 * --------------------------------------------------------------
 * A drop-in replacement for ad-hoc <table> markup that flips into
 * a stacked card layout on small screens (<768px by default).
 *
 * Usage:
 *   <ResponsiveTable
 *     columns={[
 *       { key: 'name',   header: 'Name',   primary: true },
 *       { key: 'qty',    header: 'Qty',    align: 'right' },
 *       { key: 'price',  header: 'Price',  align: 'right',
 *         render: (row) => `RM ${row.price.toFixed(2)}` },
 *       { key: 'actions', header: '', hideOnMobile: false,
 *         render: (row) => <button>Edit</button> },
 *     ]}
 *     data={rows}
 *     keyField="id"
 *     onRowClick={(row) => ...}
 *     emptyMessage="No records yet"
 *   />
 *
 * Column options:
 *   key           string  - field name (used as React key + default accessor)
 *   header        node    - column heading
 *   render        fn      - (row, index) => ReactNode (overrides key accessor)
 *   align         'left' | 'center' | 'right'
 *   primary       bool    - shown as the card title on mobile
 *   hideOnMobile  bool    - hide row entirely in mobile card view
 *   width         string  - tailwind width class for desktop col (e.g. 'w-32')
 *   className     string  - extra classes for cell
 *
 * Layout breakpoint: defaults to 'md' (768px). Below = card mode.
 */

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function getCellValue(col, row, index) {
  if (typeof col.render === 'function') return col.render(row, index)
  return row?.[col.key]
}

const ResponsiveTable = ({
  columns = [],
  data = [],
  keyField = 'id',
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  rowClassName,
  // 'sm' | 'md' | 'lg' — below this width, switch to card view
  cardBreakpoint = 'md',
  // Optional: render a custom card header on mobile
  mobileCardHeader,
  loading = false,
}) => {
  const tableHiddenBp = `${cardBreakpoint}:table`
  const cardsHiddenBp = `${cardBreakpoint}:hidden`

  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="animate-pulse space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-black-10 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`w-full text-center py-10 text-black-50 ${className}`}>
        {emptyMessage}
      </div>
    )
  }

  const primaryCol = columns.find((c) => c.primary) || columns[0]

  return (
    <div className={`w-full ${className}`}>
      {/* DESKTOP / TABLET TABLE -------------------------------------- */}
      <div className={`hidden ${tableHiddenBp} w-full`}>
        <div className="overflow-x-auto touch-scroll rounded-lg border border-black-10">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-primary-black text-primary-white">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-3 text-sm font-semibold ${alignClass[col.align] || 'text-left'} ${col.width || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr
                  key={row?.[keyField] ?? index}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  className={`border-b border-black-10 transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-black-10/40' : ''
                  } ${typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName || ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-3 text-sm ${alignClass[col.align] || 'text-left'} ${col.className || ''}`}
                    >
                      {getCellValue(col, row, index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARDS ------------------------------------------------- */}
      <div className={`${cardsHiddenBp} space-y-3`}>
        {data.map((row, index) => {
          const visibleCols = columns.filter(
            (c) => !c.hideOnMobile && c !== primaryCol
          )
          return (
            <div
              key={row?.[keyField] ?? index}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              className={`bg-primary-white border border-black-10 rounded-lg p-4 shadow-subtle ${
                onRowClick ? 'cursor-pointer active:bg-black-10/30 tap-clean' : ''
              } ${typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName || ''}`}
            >
              {/* Card header = primary column */}
              <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-black-10">
                <div className="font-semibold text-primary-black text-base break-words min-w-0 flex-1">
                  {mobileCardHeader
                    ? mobileCardHeader(row, index)
                    : getCellValue(primaryCol, row, index)}
                </div>
              </div>

              {/* Body = label/value rows */}
              <dl className="space-y-2">
                {visibleCols.map((col) => {
                  const val = getCellValue(col, row, index)
                  if (val === undefined || val === null || val === '') return null
                  return (
                    <div
                      key={col.key}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <dt className="text-black-50 shrink-0">{col.header}</dt>
                      <dd className="text-primary-black text-right break-words min-w-0">
                        {val}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ResponsiveTable
