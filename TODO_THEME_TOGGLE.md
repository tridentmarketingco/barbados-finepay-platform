# TODO: Add Dark/Light Theme Toggle Buttons to Profile Dropdown

## Task
Add dark and light button to profile dropdown menu in AdminLayout.js

## Steps Completed:
- [x] 1. Analyze existing code (AdminLayout.js, ThemeToggle.jsx, Admin.css)
- [x] 2. Modify AdminLayout.js - Add imports, state, and theme toggle buttons
- [x] 3. Modify Admin.css - Add styles for theme toggle buttons in dropdown
- [ ] 4. Test the implementation

## Implementation Details:
- Added lucide-react imports (Sun, Moon, Settings, LogOut)
- Added isDarkMode state with localStorage and system preference detection
- Added theme useEffect to handle theme changes
- Added toggleTheme function to switch between light/dark modes
- Added theme toggle section with Light and Dark buttons in dropdown
- Added CSS styles for theme toggle buttons (light and dark mode)


