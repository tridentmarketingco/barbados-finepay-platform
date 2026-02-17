# Late Fee Settings & Rules - Theme Styling TODO

## Task
Style Late Fee Settings and Late Fee Rules components for proper light and dark mode support with consistent Admin.css styling (glassmorphism, shadows, border-radius).

## Files Edited
1. `frontend/src/components/admin/LateFeeSettings.js` - ✅ Completed
2. `frontend/src/components/admin/LateFeeRules.js` - ✅ Completed

## Implementation Summary

### LateFeeSettings.js - COMPLETED
- [x] Update main container padding and max-width
- [x] Add glassmorphism card styling (background, backdrop-filter, border, box-shadow)
- [x] Update header section with consistent typography
- [x] Add dark mode styles using `html.dark` selector:
  - Background colors
  - Text colors (headings, labels, descriptions)
  - Input/select field backgrounds and borders
  - Structure config background
  - Button colors and hover states
- [x] Add consistent border-radius (28px for cards, 8px for inputs)
- [x] Update form sections with proper dividers

### LateFeeRules.js - COMPLETED
- [x] Update rules-header with flexbox styling
- [x] Add glassmorphism styling to rules-list table container
- [x] Update table styling with consistent colors
- [x] Add dark mode styles using `html.dark` selector:
  - Background colors
  - Table header/row colors
  - Badge colors (offence, category, global)
  - Status badge colors (active/inactive)
  - Button colors
  - Modal background
- [x] Update modal with glassmorphism effect
- [x] Add consistent border-radius
- [x] Add responsive styles for mobile

## Styling Standards Applied
- Glassmorphism: `background: rgba(255, 255, 255, 0.55)`, `backdrop-filter: blur(24px)`, border-radius 28px
- Dark mode: `background: rgba(30, 41, 59, 0.65)`, proper text colors
- Input fields: 2px borders, 8px border-radius, focus states
- Buttons: Consistent primary/secondary styling with hover effects
- Table: Proper header styling, row hover effects

