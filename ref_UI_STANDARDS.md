# ONEXHUB Premium UI Design System

## Core Philosophy
- **Professional & Clean:** Minimalist aesthetic, high whitespace, strict alignment.
- **Data-First:** Clear hierarchy for data presentation (Cards for summary, Tables for details).
- **No Emojis:** Use professional SVG icons (Heroicons/Lucide) only.
- **Subtle Interactions:** Hover states should be smooth (fade-ins, slight border color changes).
- **Color Palette:** Slate/Gray (neutral), Blue (primary action), Red (danger), Green (success), Orange (warning).

## Standard Component Classes

### 1. Page Layout
**Container:**
```jsx
<div className="space-y-6">
  {/* Content */}
</div>
```

### 2. Stats/Summary Cards
**Wrapper:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

**Card Item:**
```jsx
<div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex justify-between items-start">
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">$45,231</h3>
    </div>
    <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
      {/* SVG Icon */}
    </div>
  </div>
</div>
```

### 3. Data Tables
**Container:**
```jsx
<div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
  {/* Toolbar */}
  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
    {/* Title & Actions */}
  </div>
  
  {/* Table Element */}
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
        <tr>
          <th className="px-6 py-4">Column Header</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        <tr className="hover:bg-gray-50/50 transition-colors">
          <td className="px-6 py-4 text-sm text-gray-900">Data</td>
          {/* ... */}
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### 4. Interactive Elements
**Primary Button:**
```jsx
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2">
  {/* Icon */}
  <span>Button Text</span>
</button>
```

**Secondary/Outline Button:**
```jsx
<button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2">
  {/* Icon */}
  <span>Label</span>
</button>
```

**Search Input:**
```jsx
<div className="relative">
  <input 
    type="text" 
    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-gray-400"
    placeholder="Search..."
  />
  {/* Search Icon Absolute Positioned */}
</div>
```

### 5. Status Badges
**Structure:**
```jsx
<span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-opacity-50 {COLOR_CLASSES}">
  Status
</span>
```
- **Success:** `bg-green-50 text-green-700 border-green-200`
- **Warning:** `bg-orange-50 text-orange-700 border-orange-200`
- **Error:** `bg-red-50 text-red-700 border-red-200`
- **Neutral:** `bg-gray-100 text-gray-600 border-gray-200`
- **Info:** `bg-blue-50 text-blue-700 border-blue-200`

## Implementation Logic
1. Wrap page in `space-y-6`.
2. Place key metrics at the top using the Card Grid.
3. Place main functional area (Table/Form) in the "Main Content Area" container.
4. Ensure all text colors use strict `gray-900` (headings), `gray-700` (body), `gray-500` (secondary/meta).
5. Remove all emojis. Replace with heroicons/lucide-react SVGs.
