import React from 'react'

/**
 * StatsGrid
 * --------------------------------------------------------------
 * Responsive KPI/stat card grid.
 * - 1 col on phones (<sm), 2 on sm, configurable from md up.
 * - Stats can include label, value, sublabel, trend, icon, color.
 *
 * Usage:
 *   <StatsGrid
 *     stats={[
 *       { label: 'Revenue', value: 'RM 12,400', sublabel: 'This month', trend: '+12%', trendUp: true },
 *       { label: 'Orders',  value: 48,           icon: <CartIcon /> },
 *     ]}
 *     columns={{ sm: 2, md: 2, lg: 4 }}
 *   />
 */

const colMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}
const smMap = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}
const mdMap = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
}
const lgMap = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

const accentMap = {
  default: 'border-black-10',
  red: 'border-primary-red',
  black: 'border-primary-black',
  success: 'border-green-500',
  warning: 'border-yellow-500',
  info: 'border-blue-500',
}

const StatsGrid = ({
  stats = [],
  columns = { sm: 2, md: 2, lg: 4 },
  className = '',
  onCardClick,
}) => {
  const gridClasses = [
    'grid gap-3 sm:gap-4',
    colMap[1],
    columns.sm ? smMap[columns.sm] : '',
    columns.md ? mdMap[columns.md] : '',
    columns.lg ? lgMap[columns.lg] : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`${gridClasses} ${className}`}>
      {stats.map((stat, idx) => {
        const accent = accentMap[stat.accent] || accentMap.default
        const clickable = stat.onClick || onCardClick
        return (
          <div
            key={stat.key ?? stat.label ?? idx}
            onClick={
              clickable ? () => (stat.onClick ? stat.onClick(stat) : onCardClick(stat)) : undefined
            }
            className={`
              bg-primary-white border-l-4 ${accent} border-y border-r border-black-10
              rounded-lg p-3 sm:p-4 shadow-subtle transition-all
              ${clickable ? 'cursor-pointer hover:shadow-card active:scale-[0.98] tap-clean' : ''}
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-medium text-black-50 uppercase tracking-wide truncate">
                  {stat.label}
                </div>
                <div className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold text-primary-black break-words">
                  {stat.value}
                </div>
                {stat.sublabel && (
                  <div className="mt-1 text-xs text-black-50 truncate">{stat.sublabel}</div>
                )}
              </div>
              {stat.icon && (
                <div className="shrink-0 text-black-25 sm:text-black-50">{stat.icon}</div>
              )}
            </div>

            {stat.trend && (
              <div
                className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
                  stat.trendUp ? 'text-green-600' : 'text-primary-red'
                }`}
              >
                <span>{stat.trendUp ? '▲' : '▼'}</span>
                <span>{stat.trend}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default StatsGrid
