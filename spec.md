# Yieldschool Portfolio Tracker

## Overview
A cryptocurrency portfolio tracking application that allows users to manually manage their crypto holdings, view real-time prices, analyze portfolio performance, and discover new investment opportunities through market data exploration. The application includes comprehensive data persistence and import/export functionality with optimized performance for smooth real-time updates. The application features an advanced theme system with multiple predefined themes, each maintaining atmospheric layered gradients, balanced contrast, and translucent glass-blur panels for a premium, airy aesthetic with absolutely no solid color blocks or gradient fills anywhere in the interface.

## Core Features

### Authentication System
- Implement Internet Identity authentication integration for secure user access
- Create authentication hook that manages sign-in/sign-out state across the application
- **Fix**: Both navbar "Sign In" button in Header.tsx and landing page "Sign In to Portfolio" button must use the same authentication hook and flow
- **Fix**: Remove ProfileSetup modal entirely - skip any prompts for name or email input during login process
- **Fix**: Ensure both authentication buttons (navbar and landing page) use identical authentication logic and state management
- After successful authentication, automatically navigate to the Portfolio route using the app router
- Display appropriate visual feedback during authentication process:
  - Loading spinner or disabled state while authentication is in progress
  - Button text changes to indicate loading state (e.g., "Signing In...")
  - Maintain pill-shaped button styling with gradient outline during loading states
- Authentication state management:
  - Update header button text dynamically ("Sign In" when logged out, "Sign Out" when logged in)
  - Persist authentication state across browser sessions
  - **Fix**: Maintain consistent button styling (pill-shape, gradient outline, no solid fill) in all states for both header and landing page buttons
  - **Fix**: Ensure sign-in and sign-out properly update button state across all routes using the same authentication logic
  - **Fix**: Apply authentication fixes globally within the shared Layout/AppShell component so they work consistently across all routes
- Error handling for failed authentication attempts with user-friendly messages
- Automatic session management and renewal when possible
- **Fix**: Both authentication buttons must transition directly to portfolio upon successful authentication without any intermediate setup screens
- **Fix**: Ensure identical pill-style gradient outline designs, hover glow effects, and proper state transitions for both sign-in and sign-out buttons
- **Fix**: Remove any prompts for user name or email during login, ensuring authentication is smooth, one-step, and does not display extra modal dialogs or forms

### Application Layout & Navigation
- Create a shared **Layout/AppShell** component that wraps all routes: Landing, Portfolio, Market, Admin, Test, and Auth
- **Fix**: Implement authentication fixes globally within the Layout/AppShell component to ensure consistent behavior across all routes
- Implement consistent navbar layout across all pages:
  - **Left section**: Minimal wordmark "Yieldschool" with light gradient border underline + text "Portfolio Tracker" (no gradient block background)
  - **Center section**: Route tabs for navigation between pages with subdued hover glow
  - **Right section**: Pill-shaped authentication button with transparent interior, cyan→violet gradient outline, minimal padding, and soft hover/focus glow states (no solid fills)
    - Shows "Sign In" when user is not authenticated
    - Shows "Sign Out" when user is authenticated
    - Displays loading state during authentication process
    - **Fix**: Uses identical authentication flow as landing page "Sign In to Portfolio" button
    - **Fix**: Maintains identical pill-style gradient outline design, hover glow effects, and proper state transitions
- Update browser `<title>`, OpenGraph title, and navbar brand text to "Yieldschool Portfolio Tracker"
- Ensure route switching preserves consistent navbar, background, borders, and button styling across all pages
- Maintain existing business logic and data layer functionality without changes
- Navbar height: 64px with container padding-x: 24px for consistent spacing
- **Enhanced Visual Design**: Apply subtle layered graphite-to-blue-slate vertical gradient backgrounds with faint peripheral vignette for atmospheric depth instead of flat dark backgrounds
- **Refined Spacing**: Implement consistent vertical rhythm across all pages with ~24px section gaps, tighter header-to-table spacing, and slightly looser row spacing for breathing room
- **Ambient Feedback**: When portfolio values update, animate gentle accent pulse and navbar highlight to indicate live data refresh with subtle glow effects

### Advanced Theme System
- Implement comprehensive theme system with predefined theme options and customizable hue adjustment:
  - **Theme Selector**: Dropdown in Admin Panel offering 6-8 predefined themes:
    - **Midnight Neon**: Deep blue-black base with electric cyan/magenta accents
    - **Graphite Lumina**: Charcoal gray base with silver/white luminous accents
    - **Slate Minimal**: Cool gray base with subtle blue/teal accents
    - **Aurora Mist**: Dark purple base with green/pink aurora-like accents
    - **Velvet Dusk**: Rich burgundy base with gold/amber accents
    - **Carbon Shadow**: Pure black base with red/orange ember accents
    - **Ocean Flux**: Deep navy base with aqua/turquoise accents
    - **Ember Glow**: Dark brown base with orange/yellow fire accents
  - **Hue Adjustment**: Color hue slider that remaps all accent and gradient colors in real-time across any selected theme
  - **Theme Persistence**: Save both theme selection and hue adjustment in localStorage and apply on startup
- Each theme defines complete color token set using CSS variables or Tailwind tokens:
  - Background colors: bg0, bg1, bg2 (atmospheric layered gradients with graphite-to-blue-slate depth and peripheral vignette)
  - Text colors: textPrimary (~85-90% white), textMuted (~60-65% white) for reduced glare and balanced contrast
  - Accent colors: accentPrimary, accentSecondary (harmonized cyan/violet tones with consistent glow strength)
  - Status colors: success, danger, warning (theme-appropriate variants)
  - Border radius: radiusCard, radiusChip (consistent across themes)
  - Animation timing: motion (150-180ms ease-out for micro-animations)
  - **Enhanced Dividers**: Translucent divider tones (10-15% opacity) for refined table borders and visual hierarchy
- Apply enhanced theme rules consistently:
  - Body uses atmospheric layered gradient background (graphite→blue-slate) with subtle vignette and peripheral depth (no solid blocks)
  - Balanced contrast with appropriate text colors for each theme with reduced brightness for less glare
  - Headlines use subtly luminous tones for hierarchy without font size jumps
  - Cards and tables use translucent bg-blur panels with 6-8% opacity overlay and subtle ambient drop-shadows for lift and structure
  - **Refined Action Buttons**: All primary action buttons (e.g., "Add to Portfolio", "Refresh") styled as elegant gradient-outline pill buttons with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
  - Tables feature sticky headers, compact rows, softened zebra tint (2-3%), textMuted labels, and translucent border tones (10-15% opacity) with ambient drop-shadow beneath table for lift
  - Dialogs use translucent bg1 with glass blur, bordered by gradient outlines (no opaque solid fills)
  - All containers have max-width of 1440px and are center-aligned for balanced layout
  - **Micro-animations**: Implement soft fade/scale transitions on hover for buttons and table rows, and smooth fade-on-refresh for dynamic updates within 150-180ms duration with reduced-motion support
- Remove inline color overrides that conflict with the theme system
- Apply atmospheric layered gradient backgrounds with depth via subtle vignette throughout the interface
- Use theme-appropriate accent gradients exclusively for outlines and selection states with harmonized intensity
- Implement interactive focus and "hit" states with soft glows using ring-1 of 30% alpha accent
- Eliminate heavy shadows, excessive vertical padding, and all solid color blocks for compact density
- Configure typography using **Inter** across UI with **Space Grotesk** only for major headings
- Use slight letter spacing and weight contrast for elegance with reduced text brightness
- Rely on opacity and tone variations for visual hierarchy instead of font size changes
- Enhance depth through translucent layering and glass blur effects for cleaner composition
- **Critical**: Remove all large solid color or gradient blocks throughout the entire application
- **Absolute requirement**: No element anywhere in the application should use solid fills, solid backgrounds, or gradient fills - only transparent interiors with gradient outlines
- **Enhanced Visual Balance**: Replace flat dark backgrounds with subtle layered graphite-to-blue-slate gradient backgrounds with peripheral vignette for atmospheric depth
- **Refined Hierarchy**: Lighten table borders using translucent tones (10-15% opacity) and tone down visual clutter with semi-transparent row separators and hover highlights
- **Improved Spacing Rhythm**: Normalize vertical rhythm across all pages with consistent ~24px section gaps, tighter header-to-table spacing, and slightly looser row spacing for breathing room
- **Ambient Feedback Enhancement**: Add gentle pulse animation (opacity 0.6→1→0.6, 400ms) on portfolio metric updates to indicate real-time changes without being flashy
- **Charts Upgrade**: Apply gradient strokes to donuts and line charts, reduce gridline opacity, and slightly feather chart edges for cohesive visual theme integration

### Landing Page Redesign
- Redesign Landing page with elegant, professional centered layout:
  - **Enhanced Background**: Apply subtle layered graphite-to-blue-slate vertical gradient background with peripheral vignette from selected theme with atmospheric depth and radial gradient lighting around the title (no solid blocks)
  - Display centered glowing app title "Yieldschool Portfolio Tracker" as main header using Space Grotesk weight 600 with refined typography and subtle luminous effect
  - Add small tagline below title in muted text gray: "A calm way to track crypto performance."
  - **Refined Action Button**: Include single centered pill-shaped "Sign In to Portfolio" button styled as elegant gradient-outline pill with transparent interior, theme-appropriate cyan→violet gradient border, minimal padding, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
  - Apply theme tokens to all Landing page elements with max-width container (1440px) center-aligned
  - Ensure consistent styling with the global theme system for sleek, modern aesthetic
  - Maintain balanced centered layout with atmospheric layered gradient backgrounds and no solid color blocks or gradient fills anywhere
- Implement functional sign-in flow:
  - **Fix**: "Sign In to Portfolio" button must correctly trigger the Internet Identity authentication process immediately
  - **Fix**: After successful authentication, automatically navigate to portfolio dashboard using the app router
  - **Fix**: Maintain authentication state across sessions using Internet Identity session management
  - **Fix**: Ensure proper error handling for failed authentication attempts with user-friendly error messages
  - **Fix**: Display loading state during authentication with spinner or disabled button state
  - **Fix**: Button styling must remain consistent (pill-shape, gradient outline, no solid fill) in all states including loading
  - **Fix**: Skip ProfileSetup modal entirely - no prompts for name or email input after authentication
  - **Fix**: Use identical authentication logic as navbar "Sign In" button to ensure consistent behavior

### Data Model & Input Logic Implementation
- Create a TypeScript module (`frontend/src/lib/dataModel.ts`) defining all entity types:
  - `AssetMeta`: metadata for cryptocurrency assets
  - `Category`: classification types (blue chip, mid cap, low cap, micro cap, stablecoins, DeFi)
  - `Holding`: user's cryptocurrency positions with symbol, tokens owned, average cost, date, and notes
  - `LadderPreset`: exit strategy configurations with multiple rungs, preset name, and applicable categories
  - `ExitLadderConfig`: individual asset exit ladder configuration with preset type (Conservative, Aggressive, Custom), locked state, and custom rung data
  - `Settings`: application configuration and thresholds including theme settings (selected theme name and hue adjustment), number formatting, category thresholds, ladder presets, price provider settings, table density preferences, and hidden column preferences
  - `PriceQuote`: real-time price data
  - `Transaction`: buy/sell/transfer records including realized P&L calculations
  - `PortfolioSnapshot`: time-series data for performance tracking with timestamp, total value, and category breakdowns
  - `MarketAsset`: market data for discovery including symbol, name, price, 24h change, market cap, and volume
- Implement pure helper functions:
  - **Fix**: `categorize(marketCapUsd, thresholds)` must correctly apply thresholds (`blueMin=10e9`, `midMin=1e9`) and return appropriate category based on market cap
  - **Fix**: Add comprehensive console logging to show marketCap values and category results during price updates to confirm correct classification
  - **Fix**: Ensure marketCapUsd from price service is parsing numeric values correctly (not text) and not defaulting to 0 on fallback errors
  - `stableCategorize(prevCategory, prevSeenAt, newMarketCap, thresholds, hysteresis)` handles category transitions with hysteresis logic
  - `valueUsd(holding, price)` calculates current USD value of a holding
  - `initialCostUsd(holding)` calculates original investment cost
  - `share(value, portfolioTotal)` calculates percentage allocation
  - `buildExitLadder(holding, preset, avgCost)` creates exit strategy with multiple price rungs
  - `buildCustomExitLadder(holding, customRungs, avgCost)` creates exit strategy from custom rung configuration
  - **Fix**: `portfolioTotals(holdings, prices, cash)` must correctly sum the `value` of all assets to calculate accurate total portfolio value
  - `calculatePnL(currentValue, initialCost)` calculates profit/loss metrics
  - `calculateRealizedPnL(transactions)` calculates realized gains/losses from completed sales
  - `getBestWorstMovers(holdings, prices)` identifies top and bottom performers
  - `generateSparklineData(snapshots, timeRange)` creates data points for mini performance charts
  - `checkExitHits(holdings, prices, ladderPresets)` identifies which exit rungs have been hit
  - `calculateWeightedAverage(oldAvgCost, oldTokens, newCost, newTokens)` computes weighted average cost for position merging
- Implement input logic functions:
  - `addHolding(symbol, tokensOwned, optional avgCost/date/notes)` adds new position or merges with existing position using weighted average cost calculation
  - `updateHolding(id, partial)` modifies existing holding
  - `lockCategory(id, flag)` prevents automatic recategorization
  - `recordTransaction(tx)` processes buy/sell/transfer and updates holdings and cash
  - `recordSnapshot(timestamp, totals)` saves portfolio state for performance tracking
  - `logSale(holdingId, tokensToSell, salePrice)` records partial or full position sales with realized P&L
  - `mergeHoldings(existingHolding, newTokens, newAvgCost)` combines positions for same symbol using weighted average formula
  - `updateExitLadderConfig(holdingId, config)` updates exit ladder configuration for specific asset
  - `setExitLadderPreset(holdingId, presetType)` applies preset ladder configuration to asset
  - `unlockCustomLadder(holdingId)` enables custom editing mode for exit ladder
- **Fix**: Implement hysteresis logic to prevent category flickering:
  - Only recategorize when market cap crosses thresholds by specified percentage buffer
  - Or when asset remains across boundary for minimum hours threshold
  - Ensure updated categories propagate live to the table only when valid data updates occur
- Export in-memory store containing:
  - `holdings[]` array of user positions
  - `transactions[]` transaction history including sale records
  - `portfolioSnapshots[]` time-series performance data
  - `lastSeenCategories` tracking previous categorizations with timestamps
  - `marketAssets[]` array of market data for discovery features
  - `uiPreferences` object storing table density and column visibility
  - `themeSettings` object storing selected theme name and hue adjustment value
  - `ladderPresets[]` array of custom exit strategy presets with names and applicable categories
  - `exitLadderConfigs[]` array of per-asset exit ladder configurations with preset types and custom data
  - `lastSeenCategories` tracking previous categorizations with timestamps
- Include mock dataset with 4 sample assets across blue chip, mid cap, and low cap categories plus cash position
- Generate mock time-series data for performance charts with realistic price movements over 1 year
- Create test page (`frontend/src/pages/DataModelTest.tsx`) that demonstrates and logs helper function results
- Include inline test comments verifying:
  - Market cap categorization thresholds (10B+ = blue, 1B+ = mid, below 1B = low)
  - Exit ladder generation returns correct number of rungs totaling 100%
  - Transaction recording properly updates holdings and cash balances
  - Realized P&L calculations from sale transactions
  - Weighted average cost calculation for position merging
  - Custom exit ladder configuration persistence and synchronization
- Ensure module compiles and runs independently with mock data before integration
- **Performance Optimization**: Cache calculation results using `useMemo` and implement efficient data cloning with `structuredClone` for updates

### Data Persistence & Storage
- Create a TypeScript module (`frontend/src/lib/persistence.ts`) implementing:
  - **Schema Versioning**: Define versioned data schema with current version identifier
  - **Auto-Save**: Automatically persist entire store to localStorage on any data changes (holdings, settings, transactions, price cache, UI preferences, theme settings, ladder presets, exit ladder configurations)
  - **Schema Migration**: Detect schema version on load and migrate data structure if versions differ
  - **Data Validation**: Validate loaded data structure and handle corrupted or invalid localStorage data gracefully
  - **Storage Key Management**: Use versioned schema keys for localStorage to prevent conflicts
- Implement persistence functions:
  - `saveStore(store)` serializes and saves complete application state to localStorage including UI preferences, theme settings, ladder presets, and exit ladder configurations
  - `loadStore()` retrieves and deserializes application state with schema migration
  - `migrateSchema(oldData, oldVersion, newVersion)` handles data structure updates between versions
  - `validateSchema(data)` ensures loaded data matches expected structure
- Integration requirements:
  - All store updates (holdings, settings, transactions, UI preferences, theme settings, ladder presets, exit ladder configurations) trigger automatic persistence
  - Application startup loads persisted data and applies any necessary migrations
  - Graceful fallback to default state with default theme if localStorage data is corrupted or incompatible

### Import/Export Functionality
- Create a TypeScript module (`frontend/src/lib/importExport.ts`) implementing comprehensive data exchange:
  - **JSON Export**: Generate single JSON file containing complete application state (holdings, settings, transactions, price cache, UI preferences, theme settings, ladder presets, exit ladder configurations)
  - **JSON Import**: Parse uploaded JSON files, validate schema version, and preview changes before applying
  - **CSV Export**: Generate separate CSV files for:
    - Holdings (columns: Symbol, Tokens Owned, Avg Cost, Purchase Date, Value USD)
    - Transactions (columns: Type, Symbol, Tokens, Price USD, Fee USD, Timestamp, Realized PnL)
    - Ladder Plans per asset (columns: Symbol, Target Price, Sell Amount, Sell Percent)
  - **CSV Import**: Parse holdings CSV with validation for data types and required fields
  - **Import Preview**: Show diff comparison highlighting changes, additions, and validation errors
  - **Data Validation**: Comprehensive validation for imported data with user-friendly error messages
- Export functions:
  - `exportJSON(store)` creates downloadable JSON file with complete application state including theme settings, ladder presets, and exit ladder configurations
  - `exportHoldingsCSV(holdings, prices)` generates CSV with current portfolio positions
  - `exportTransactionsCSV(transactions)` generates CSV with transaction history including realized P&L
  - `exportLadderPlansCSV(holdings, ladderPresets, exitLadderConfigs)` generates CSV with exit strategies per asset including custom configurations
- Import functions:
  - `importJSON(file)` parses and validates JSON import with preview generation
  - `importHoldingsCSV(file)` parses CSV and validates holdings data with error reporting
  - `generateImportPreview(currentData, importedData)` creates diff comparison for user review
  - `applyImport(validatedData)` merges imported data into application state

### Price Fetching & Aggregation
- Create a TypeScript module (`frontend/src/lib/priceService.ts`) implementing:
  - `PriceProvider` interface with `getPrice(symbols: string[]): Promise<PriceQuote[]>` method
  - `CoinGeckoProvider` class implementing the PriceProvider interface for CoinGecko API integration
  - `CryptoRatesProvider` class implementing the PriceProvider interface for CryptoRates.ai API integration
  - `PriceAggregator` class that:
    - Uses CoinGecko as primary provider and CryptoRates.ai as fallback provider
    - **Fix**: Normalizes all price data to USD format and ensures `marketCapUsd` is properly parsed as numeric values (not text strings)
    - **Fix**: Prevents defaulting to 0 on fallback errors and maintains proper numeric data types
    - Implements per-symbol caching with configurable time-to-live (TTL) from admin settings
    - Rate limits each provider to maximum 50 requests per minute
    - Automatically uses bulk fetch when more than 3 symbols are requested
    - Emits events when a symbol's price or market cap changes by more than 1%
    - Returns stale data marked as `stale: true` when both providers fail, using last known cached data
    - Triggers portfolio snapshot recording on significant price changes
    - Respects admin settings for fallback provider enable/disable
    - **Enhanced**: Provides `getCurrentPrice(symbol)` method for real-time price fetching that correctly returns current market price for use in unified Add/Edit Asset modal, with fallback to last cached price if live fetch is unavailable
    - **Performance Optimization**: Throttle price update events to maximum 1 update per 1-2 seconds to prevent excessive re-renders
- Include mock mode functionality:
  - Simulates price updates every 5 seconds using random walk algorithm for both price and market cap
  - Provides simple event emitter for downstream listeners to handle category updates
  - Automatically records portfolio snapshots during mock price updates
  - **Performance Optimization**: Throttle mock updates to prevent UI lag
- Acceptance criteria verification:
  - When requesting 5 symbols, aggregator performs single bulk API call and returns 5 price quotes
  - When primary provider fails, fallback provider supplies quotes and logs the failover event
  - When market cap changes significantly, events are published for category rechecking

### Market Data Service
- Create a TypeScript module (`frontend/src/lib/marketService.ts`) implementing:
  - `MarketDataProvider` interface for fetching market discovery data
  - `CoinGeckoMarketProvider` class implementing market data fetching from CoinGecko API
  - `MarketDataAggregator` class that:
    - Fetches top cryptocurrencies by 24-hour trading volume
    - Excludes blue chip assets and stablecoins from feed results
    - Implements caching with 5-minute TTL for market data
    - Provides filtering capabilities for market cap range, price performance, and volume
    - Supports text search by symbol or name
    - Returns sortable market data with columns: Symbol, Name, Price, 24h %, Market Cap, Volume 24h
- Include mock market data with realistic cryptocurrency assets for development and testing

### Charts & Analytics Module
- Create a TypeScript module (`frontend/src/lib/chartsAnalytics.ts`) implementing Recharts-based visualizations styled with selected theme:
  - **Allocation Donut Chart**: Interactive pie chart showing Blue Chip, Mid Cap, and Low Cap category allocations
    - Display percentage and USD value on hover using theme colors
    - Click slice to highlight and filter portfolio table to selected category
    - Sync with portfolio totals and update dynamically on edits or price changes with smooth fade-and-scale transitions (150-180ms)
    - Style with atmospheric layered gradient backgrounds, gradient line strokes, reduced gridline opacity, feathered chart edges, and elegant tooltip styling (no solid blocks)
    - **Performance Optimization**: Limit chart redraws to maximum 1 update per 1-2 seconds using throttling
  - **Category Trend Small Multiples**: Three mini line charts showing individual category value trends
    - One chart each for Blue Chip, Mid Cap, and Low Cap categories
    - Synchronized time ranges with main performance chart
    - Apply compact styling with theme colors, gradient line strokes, reduced gridline opacity, feathered chart edges, and smooth update animations (no solid blocks)
    - **Performance Optimization**: Use lightweight chart components and efficient rendering
  - **Analytics KPI Cards**: Four full-width rectangular tiles displaying:
    - Total portfolio value, 24h P&L, 7d P&L, Best mover, and Worst mover
    - Style as full-width rectangular tiles with transparent interiors and theme-appropriate gradient outlines (no solid fills)
    - All four tiles stretch evenly across the full width of the metric bar in a single row
    - Animate value changes with subtle fade-and-scale transitions (150-180ms)
    - **Performance Optimization**: Use CSS transitions instead of React state updates for animations
- Ensure all charts meet WCAG AA contrast standards using theme color tokens
- Integrate with existing store and price service for real-time updates with smooth animations
- Apply number formatting settings from admin panel to all displayed values
- Style all chart components with selected theme colors, gradient line strokes, reduced gridline opacity, feathered chart edges, elegant tooltip styling, and compact density (no solid blocks)
- Implement subtle fade-and-scale transitions (150-180ms ease-out) to indicate value, category, or P&L changes with reduced-motion support
- **Performance Optimization**: Use hardware acceleration hints (`will-change`, `transform`) for smooth animations and batch animation updates

### Exit Strategy Management
- Create a dedicated Exit Strategy page accessible via navigation with comprehensive exit ladder management:
  - **Asset Selection**: Dropdown or tabs to select which asset's exit strategy to configure
  - **Preset Selection with Enhanced UI**: Display three preset buttons (Conservative, Aggressive, Custom) with soft glowing highlight to indicate which preset is currently active per asset
    - **Conservative Preset**: Locked percentages and multipliers by default with predefined ladder configuration
    - **Aggressive Preset**: Locked percentages and multipliers by default with predefined ladder configuration  
    - **Custom Preset**: Unlocks editing for percentage and multiplier fields when selected, allowing full customization
  - **Custom Mode Functionality**:
    - Add "Custom" button that, when clicked, unlocks editing for percentage and multiplier fields
    - Enable saving custom ladder configurations that persist until the user switches presets again
    - Prevent premature reversion to preset defaults—custom edits remain active until a new preset is explicitly selected
    - Custom configurations are saved per asset and persist across page reloads
  - **Exit Ladder Configuration**: Table showing exit points with columns in this exact order:
    1. **Percent**: Percentage to sell at each exit point (editable in Custom mode)
    2. **Multiplier**: Multiplier for calculating target price (editable in Custom mode)
    3. **Tokens to Sell**: Calculated from percentage and total holdings
    4. **Target Price**: Calculated based on formula: `(average cost * 1.1) * multiplier` when "Base" is checked
    5. **Proceeds**: Tokens to sell × target price
    6. **Profit from Sale**: (Tokens to sell × target price) − (tokens to sell × average cost per token)
  - **Dynamic Recalculation**: Ladder table dynamically recalculates price, proceeds, and profit in all rows, including the "Remaining" row, when numbers change
  - **Base Price Toggle**: Checkbox to use base price calculation (average cost * 1.1) for target price calculations
  - **Real-time Synchronization**: Changes made on Exit Strategy page immediately reflect in Portfolio view's Exit Ladder column
  - **Preset Management**: Ability to save and load exit strategy presets for different risk profiles
  - **Validation**: Ensure percentages sum to 100% or less, with clear error messaging
  - **Live Updates**: Exit ladder data persists across page reloads and synchronizes between Portfolio and Exit Strategy views
  - **Visual Consistency**: Keep visual consistency with the existing sleek theme and animation patterns throughout these components
- **Fix**: Ensure BTC exit ladder calculations use correct formula: target price = `(average cost * 1.1) * multiplier` when "Base" is checked
- **Fix**: Apply consistent number formatting across all exit ladder calculations and displays
- **Fix**: Verify synchronization between Portfolio Exit Ladder column and Exit Strategy page works in real-time
- **Fix**: Populate the default Blue Chip Conservative ladder with proper default rungs:
  - 10% at 1.2× base
  - 20% at 1.4× base
  - 25% at 1.8× base
  - 40% at 2.0× base
  - 5% remaining
- **Fix**: Ensure these Blue Chip Conservative defaults load automatically for Blue Chip assets while keeping Aggressive and Conservative ladders for mid and low caps intact
- **Fix**: Verify ladder calculations use correct token percentages and multipliers consistently across all assets

### Portfolio Dashboard UI
- Create a main portfolio page with **two-pane expanded layout** as the default and only mode with comprehensive functionality styled with selected theme:

#### Two-Pane Expanded Layout (Default and Only Mode)
- **Left Pane - Portfolio Assets**: Contains the main portfolio table and controls
  - **Sticky Summary Ribbon**: Fixed at top showing Total Value, 24h Change, Cash with atmospheric layered gradient styling and translucent panels (no solid blocks)
  - **Analytics KPI Cards**: Four full-width rectangular tiles in a single row showing Total Value, 24h P&L, 7d P&L, Best mover, and Worst mover styled with transparent interiors and theme-appropriate gradient outlines, all stretching evenly across the full width of the metric bar, animated with subtle fade-and-scale transitions (150-180ms)
  - **Global Add Asset Input**: Symbol autocomplete with tokens input styled with transparent interior and theme-appropriate gradient outline. "More options" toggle reveals average cost and purchase date fields
  - **Grouped Table**: Collapsible sections for Blue Chip, Mid Cap, and Low Cap categories with columns for Symbol, Price, Tokens, Value USD, Share, Avg Cost, Pct Up, Notes, and Actions (Edit, Log sale, Lock/Unlock, Remove) using translucent panels with smooth animations for category changes (no solid blocks)
  - **Fix**: Make all columns visible by default except for "Exit Ladder" and "Notes" columns
  - **Ladder Strategy Integration**: Portfolio table displays exit ladder rungs as visual chips showing target prices and sell percentages, with real-time hit detection highlighting achieved targets in theme success colors, and enabling batch sale logging through action buttons styled as elegant gradient-outline pills
  - **Fix**: Exit Ladder column sources its data directly from the Exit Strategy page configuration, with immediate synchronization of any changes including custom configurations
- **Right Pane - Charts & Analytics**: Contains visualization components with repositioned layout
  - **Large Interactive Allocation Donut Chart**: Shows category allocations with click-to-filter functionality, positioned upward to occupy space previously held by standalone performance chart and visible above the fold
  - **Category Trend Small Multiples**: Three mini line charts showing individual category value trends, positioned below donut chart and visible above the fold
  - **Preset Cards**: Three preset cards (Conservative, Balanced, Aggressive) for target allocation comparison
  - **Definitions Panel**: Explaining category thresholds and portfolio metrics
- **Responsive Chart Sizing**: Charts in right pane resize responsively to maintain visual alignment with asset tables in left pane
- **Visual Alignment**: Ensure charts and tables maintain consistent visual hierarchy and spacing rhythm across both panes
- **Performance Optimization**: Implement `React.memo` for heavy components like `PortfolioTable`, `AllocationChart`, and `PortfolioDashboard` to prevent unnecessary re-renders

#### Quick-Action Bar
- **Top Dashboard Bar**: Horizontal bar positioned above the main content area with one-click actions:
  - **Enhanced Action Buttons**: "Add Asset" and "Log Sale" buttons styled as elegant gradient-outline pill buttons with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
  - Active filter indicators showing current category filters or search terms as removable chips
  - All buttons maintain consistent theme styling with soft hover/focus glow states
- **Responsive Behavior**: Quick-action bar adapts to screen size, collapsing less critical actions into overflow menu on smaller screens
- **State Integration**: Buttons trigger appropriate modals and maintain current user context

#### Unified Add/Edit Asset Modal
- **Single Modal Interface**: Merge "add asset" and "edit asset" functionality into one intelligent modal that:
  - Detects if the entered symbol matches an existing holding
  - Automatically switches between "Add New Asset" and "Edit Existing Asset" modes
  - Recalculates weighted average cost when merging positions
  - Preserves existing metadata (notes, locked category) when editing
- **Enhanced Price Integration**: 
  - **Refined Action Button**: "Use Current Price" button styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
  - Fetches real-time price using `getCurrentPrice(symbol)` method
  - Falls back to last cached price if live fetch is unavailable
  - Displays price source indicator (live/cached) with timestamp
- **Smart Form Behavior**:
  - Symbol autocomplete with real-time validation
  - Tokens and dollar amount inputs with automatic conversion
  - Expandable advanced fields (average cost, purchase date, notes)
  - Real-time preview of weighted average cost calculation for existing holdings
- **Modal Styling**: Translucent bg1 with glass blur, bordered by theme-appropriate gradient outlines with atmospheric layered gradient backgrounds

#### Real-Time Update Animations
- **Smooth Transitions**: Implement subtle fade-and-scale transitions (150-180ms ease-out) for:
  - Value changes in holdings table and metric strips
  - Category movements between Blue Chip, Mid Cap, and Low Cap sections
  - P&L updates in real-time price changes
  - Chart data updates and donut chart slice changes
  - Button hover states and interactive elements
  - Ladder rung hit detection and visual feedback
- **Non-Distracting Animations**: Ensure animations are subtle and don't interfere with user workflow:
  - Use opacity changes (0.7 to 1.0) combined with slight scale (0.98 to 1.0)
  - Apply consistent timing (150-180ms) across all animated elements
  - Avoid excessive motion that could cause distraction or accessibility issues
  - Include reduced-motion support for accessibility preferences
- **Performance Optimization**: 
  - Batch animation updates to prevent excessive re-renders during rapid price changes
  - Use CSS transitions instead of React state updates where possible
  - Implement hardware acceleration hints (`will-change`, `transform`) for smooth animations
  - Throttle animation triggers to prevent UI lag
- **Ambient Visual Feedback**: When total portfolio values update, animate gentle pulse (opacity 0.6→1→0.6, 400ms) and navbar highlight to indicate live data refresh with subtle glow effects

#### Dashboard Behavior
- **Fix**: Integrate auto-categorization using corrected hysteresis logic from data model with proper threshold application
- **Fix**: Ensure updated categories propagate live to the table only when valid data updates occur with smooth animations
- **Fix**: Correct total portfolio value calculation to properly sum the `value` of all assets
- Animate transitions when assets move between category groups with toast notifications (e.g., "SEI moved to Mid cap") styled with translucent panels and theme-appropriate gradient outlines
- Lock category toggle prevents automatic recategorization for individual assets
- Real-time updates: edits recalculate totals and update all charts immediately with smooth animations
- Preset selection overlays Actual vs Target bars on category headers styled with translucent panels (no solid blocks)
- Sidebar Definitions panel dynamically reflects current threshold settings from admin panel
- Donut chart slice clicks filter table to show only selected category
- Apply theme settings and number formatting from admin panel throughout the interface
- **Active Ladder Strategy Features**: Exit ladder hit detection highlights achieved targets and enables batch sale logging with visual rung chips in portfolio table
- **Fix**: Exit ladder data in Portfolio table sources directly from Exit Strategy page with real-time synchronization including custom configurations
- Realized vs Unrealized P&L tracking with separate tabs in sidebar
- **Position Merging**: Unified modal handles position merging using weighted average cost formula and updates total tokens
- **Market Price Integration**: "Use Current Price" button in unified modal fetches real-time price with fallback to cached price
- Preserve and use current user preferences (density, hidden columns, theme settings) stored in localStorage
- **Fix**: Default column visibility shows all columns except "Exit Ladder" and "Notes"
- **Performance Optimization**: 
  - Use `useMemo` for expensive calculations like portfolio totals and categorization
  - Defer expensive computations using `requestIdleCallback`
  - Cache results of repetitive calculations in the data model
  - Implement efficient data cloning with `structuredClone` for updates

#### Accessibility Features
- Enable keyboard navigation across the entire table interface and charts
- Add comprehensive ARIA labels for all interactive elements including chart components
- Ensure color contrast meets WCAG AA standards using theme color tokens
- Support screen reader navigation for complex chart elements
- Maintain accessibility in two-pane expanded mode
- Ensure animations respect prefers-reduced-motion settings with proper reduced-motion support

#### Acceptance Criteria
- Adding SOL with 100 tokens displays correctly in appropriate category with calculated value and portfolio share
- Adding SOL again with 50 tokens opens unified modal in "edit mode" and merges with existing position using weighted average cost calculation
- **Enhanced**: "Use Current Price" button fetches latest price with fallback to cached price and auto-fills the average cost field correctly
- **Enhanced**: ICP with market cap near $3B is correctly categorized as Mid Cap (not Low Cap) based on proper threshold application
- **Fix**: Total portfolio value correctly sums all asset values and displays accurate totals
- **Fix**: All columns are visible by default except "Exit Ladder" and "Notes"
- **Fix**: Exit Ladder column displays data sourced from Exit Strategy page with real-time synchronization including custom configurations
- **Fix**: BTC exit ladder calculations use correct formula: target price = `(average cost * 1.1) * multiplier` when "Base" is checked
- **Fix**: Exit ladder synchronization persists across page reloads and works consistently between Portfolio and Exit Strategy views
- **Enhanced Exit Strategy**: Preset buttons (Conservative, Aggressive, Custom) show soft glowing highlight for active preset per asset
- **Custom Mode**: Clicking "Custom" button unlocks percentage and multiplier editing fields and enables saving custom configurations
- **Persistent Custom**: Custom edits remain active until a new preset is explicitly selected, preventing premature reversion to defaults
- **Dynamic Recalculation**: All ladder table rows including "Remaining" row recalculate automatically when values change
- Selecting a preset (Conservative/Balanced/Aggressive) overlays target allocation bars and shows Actual vs Target comparison per category
- Locking a category prevents automatic group movement even when market cap changes trigger recategorization
- All interactions update portfolio totals and all visualizations in real-time with smooth fade-and-scale animations (150-180ms)
- Donut chart reflects same totals as the table and updates on edit with smooth transitions
- Clicking a donut slice filters the table to that category
- Column chooser settings persist in localStorage
- **Ladder Strategy Active**: Exit rung hits display as glowing theme success color chips with fade/scale animation and enable batch sale logging through action buttons
- Position merging preserves metadata like lockedCategory and notes from existing holding
- All UI elements use selected theme colors and styling consistently with atmospheric layered gradient backgrounds and no solid blocks or gradient fills
- **Enhanced Action Buttons**: All primary action buttons use elegant gradient-outline pill design with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- Quick-action bar provides one-click access to "Add Asset," "Log Sale," and active filter management
- Unified modal correctly detects existing holdings and switches between add/edit modes automatically
- Real-time animations are subtle, non-distracting, and respect accessibility preferences with reduced-motion support
- All user preferences (density, hidden columns, theme settings) are preserved and used consistently
- **Two-Pane Layout**: Portfolio assets display in left pane with charts and analytics in right pane, maintaining responsive sizing and visual alignment
- **Chart Responsiveness**: Charts in right pane resize appropriately to align with asset tables in left pane
- **Enhanced Visual Design**: Interface uses subtle layered graphite-to-blue-slate gradient backgrounds with peripheral vignette for atmospheric depth instead of flat dark backgrounds
- **Refined Hierarchy**: Table borders use translucent tones (10-15% opacity) and semi-transparent row separators with 2-3% zebra tint for reduced visual clutter
- **Micro-animations**: Soft fade/scale transitions on hover for table rows and interactive controls within 150-180ms duration with reduced-motion support
- **Ambient Feedback**: Portfolio value updates trigger gentle pulse animation (opacity 0.6→1→0.6, 400ms) and navbar highlight with subtle glow effects
- **Improved Spacing**: Normalized vertical rhythm with consistent ~24px section gaps, tighter header-to-table spacing, and slightly looser row spacing for breathing room
- **Chart Upgrades**: All Recharts components feature gradient line strokes, reduced gridline opacity, feathered chart edges, and elegant tooltip styling
- **Ambient Drop-Shadow**: Tables have subtle ambient drop-shadow beneath for lift and structure
- **Performance**: Application runs smoothly at 60fps with no visible lag during price updates or table interactions
- **CPU Optimization**: Reduced CPU usage in browser dev tools during data refresh cycles
- **Smooth Charts**: Charts animate fluidly with throttled updates (maximum 1 update per 1-2 seconds)
- **Single Row KPI Layout**: All four KPI tiles (Total, 24h P&L, 7d P&L, Best mover, Worst mover) stretch evenly across the full width of the metric bar in a single row with identical rectangular styling
- **Coherent Tile Spacing**: All tiles maintain consistent width, height, and styling with proper spacing between them
- **Right Panel Layout**: Donut chart and category breakdowns moved upward and visible above the fold without scrolling
- **Ladder Integration**: Exit ladder strategy features are active and visually integrated within portfolio table with rung chips and real-time hit detection including custom configurations

### Market Discovery Tab
- Create a dedicated Market tab with two main sections styled with selected theme: Top-Volume Feed and Screener
- **Enhanced Visual Polish**: Apply refined Market page styling with:
  - **Subtle Layered Background**: Implement graphite-to-slate gradient background layering with peripheral vignette for atmospheric depth (no solid blocks)
  - **Softened Dividers**: Use translucent divider tones (10-15% opacity) for refined visual hierarchy and reduced visual clutter
  - **Enhanced Button Animations**: Improve hover animation and glow effects for all action buttons with 150ms ease-out transitions
  - **Balanced Spacing Rhythm**: Adjust spacing throughout the Market page for better visual balance with consistent ~24px section gaps
- **Top-Volume Feed Section**:
  - Display sortable table with columns: Symbol, Name, Price, 24h %, Market Cap, Volume 24h using translucent panels with semi-transparent row separators, 2-3% zebra tint, and ambient drop-shadow beneath table (no solid blocks)
  - **Enhanced Action Button**: Include refresh button styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions to fetch latest market data (no solid fills)
  - Show top cryptocurrencies by 24-hour trading volume (excluding blue chips and stablecoins)
  - Enable sorting by any column, with special attention to correct 24h % sorting
  - **Refined Action Buttons**: Add "Add to portfolio" action button for each row styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- **Screener Section**:
  - Implement filter controls styled with translucent panels and theme-appropriate gradient outlines for:
    - Market cap range (min/max inputs)
    - Price performance filters (1D, 7D percentage change ranges)
    - Volume filter (minimum 24h volume)
    - Text search by symbol or name
  - Display filtered results in same table format as feed with translucent panels, semi-transparent row separators, 2-3% zebra tint, and ambient drop-shadow beneath table (no solid blocks)
  - Dynamically update results as filters are applied
  - **Enhanced Action Buttons**: Include "Add to portfolio" action for each filtered result styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- **Navigation Integration**:
  - "Add to portfolio" button navigates to Portfolio tab
  - Pre-fills the unified Add/Edit Asset modal with selected symbol
  - Maintains user context when switching between tabs
- **Performance Optimization**: Implement virtualization for long market data tables using `react-window` if applicable

#### Market Tab Behavior
- Sorting by 24h % correctly reorders rows from highest to lowest (or vice versa)
- Applying market cap filter shows only assets within specified range
- Text search filters results by matching symbol or name
- Clicking "Add to portfolio" navigates to portfolio page with symbol pre-filled in unified modal
- Refresh button updates all market data and maintains current sort/filter state
- All filters work in combination to narrow results appropriately
- Apply number formatting settings from admin panel to all displayed values
- All UI elements styled consistently with selected theme with atmospheric layered gradient backgrounds (no solid blocks)
- **Enhanced Market Polish**: Refined visual design with graphite-to-slate background layering, softened dividers, improved button hover animations, and balanced spacing rhythm
- **Improved Spacing**: Normalized vertical rhythm with consistent ~24px section gaps, tighter header-to-table spacing, and slightly looser row spacing for breathing room
- **Enhanced Row Interactions**: Row hover background uses theme bg2 with 2-3% tint and semi-transparent separators with micro-animations (150-180ms)

#### Acceptance Criteria
- Sorting by 24h % reorders rows correctly showing proper numerical sorting
- Applying a market cap filter (e.g., $1B-$10B) shows only assets in that range
- Text search for "BTC" shows Bitcoin and related assets
- Clicking "Add to portfolio" for any asset navigates to Portfolio tab with that symbol ready in unified modal
- Multiple filters can be applied simultaneously and results update dynamically
- Refresh button fetches latest data while preserving current view state
- All components use selected theme styling consistently with atmospheric layered gradient backgrounds and no solid blocks or gradient fills
- **Enhanced Action Buttons**: All buttons use elegant gradient-outline pill design with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- **Market Visual Polish**: Market page displays refined styling with graphite-to-slate background layering, softened dividers (10-15% opacity), enhanced button hover animations, and balanced spacing rhythm
- **Refined Table Design**: Tables feature semi-transparent row separators, 2-3% zebra tint, improved spacing rhythm, and ambient drop-shadow beneath for lift
- **Micro-animations**: Smooth hover effects and transitions with reduced-motion support
- **Performance**: Market tab operates smoothly with efficient rendering and no lag during filtering or sorting

### Admin Panel
- Create a comprehensive admin panel accessible via navigation with selected theme styling and the following settings categories:
- **Fix**: Resolve the issue causing a blank screen when clicking the "Admin" button to ensure proper navigation and rendering

#### Theme Settings
- **Theme Selector Dropdown**: Dropdown menu offering 6-8 predefined themes:
  - Midnight Neon, Graphite Lumina, Slate Minimal, Aurora Mist, Velvet Dusk, Carbon Shadow, Ocean Flux, Ember Glow
  - Each option shows small preview sample or color swatch indicating theme appearance
  - Dropdown styled with translucent panel and theme-appropriate gradient outline
- **Color Hue Slider**: Adjustable hue control that remaps all accent and gradient colors in real-time across any selected theme
  - Slider styled with theme-appropriate gradient track and handle
  - Real-time preview showing how hue adjustment affects current theme colors
- **Theme Preview Cards**: Small live preview cards or samples showing how each theme looks with current hue setting
- **Real-time Application**: Theme changes and hue adjustments apply immediately across the entire application
- **Persistence**: Both theme selection and hue adjustment value saved in localStorage and restored on startup

#### Number Formatting
- Decimal precision controls for price values (0-8 decimal places) styled with translucent panels and theme-appropriate gradient outlines
- Decimal precision controls for token quantity values (0-8 decimal places)
- Default currency selector (USD only initially, but maintain extensible structure for future currencies)
- Live preview showing formatted numbers as settings change

#### Category Thresholds
- Editable numeric inputs for `blueMin` threshold (minimum market cap for blue chip category) styled with translucent panels and theme-appropriate gradient outlines
- Editable numeric inputs for `midMin` threshold (minimum market cap for mid cap category)
- Input validation ensuring logical ordering (blueMin > midMin > 0)
- **Enhanced Action Button**: "Reset to Defaults" button styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions restoring original thresholds (10B for blue, 1B for mid) (no solid fills)
- On threshold change, display recompute preview modal with translucent panels showing which assets would move categories
- **Refined Action Buttons**: Confirmation dialog with "Apply Changes" and "Cancel" options styled as elegant gradient-outline pills with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions before reclassifying assets (no solid fills)

#### Price Provider Settings
- **Enhanced Toggle**: Toggle switch styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions to enable/disable fallback provider (CryptoRates.ai) (no solid fills)
- Numeric input for cache TTL (time-to-live in seconds) with validation (minimum 10 seconds)
- Display current provider status indicators (primary active, fallback active, using stale data) using theme colors
- Provider health monitoring showing last successful fetch times

#### UI Preferences
- Default table density selection (compact, comfortable, spacious)
- **Fix**: Default column visibility settings for holdings table with all columns visible except "Exit Ladder" and "Notes"
- Sidebar default width and resize behavior preferences

#### Data Management
- **Import Section** styled with translucent panels and theme-appropriate gradient outlines:
  - **Enhanced Action Buttons**: "Import JSON" and "Import Holdings CSV" buttons styled as elegant gradient-outline pills with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions to upload data files (no solid fills)
  - Import preview modal with translucent panels showing diff comparison with current data
  - Validation error display with specific field-level feedback
  - **Refined Action Buttons**: Confirmation dialog with buttons styled as elegant gradient-outline pills with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions before applying imported changes (no solid fills)
- **Export Section** styled with translucent panels and theme-appropriate gradient outlines:
  - **Enhanced Action Buttons**: "Export JSON," "Export Holdings CSV," "Export Transactions CSV," and "Export Ladder Plans CSV" buttons styled as elegant gradient-outline pills with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions to download data files (no solid fills)
  - Export progress indicators and success notifications using theme colors

#### Admin Panel Behavior
- All settings persist automatically in localStorage via the persistence module including theme settings
- Changes to decimal precision propagate immediately to all tables, charts, and displays
- Threshold changes show preview modal before applying to prevent accidental reclassification
- Include input validation with error messages and safe fallbacks for invalid entries using theme colors
- Provide undo functionality for accidental changes
- Theme changes apply immediately with smooth transitions using motion timing across entire application
- Import operations show progress indicators and detailed validation feedback
- Export operations generate files with user-friendly names and timestamps including theme settings in JSON exports
- UI preference changes apply immediately to current session and persist for future sessions
- **Fix**: Default column visibility setting ensures all columns are visible except "Exit Ladder" and "Notes"
- All UI elements consistently styled with selected theme with atmospheric layered gradient backgrounds (no solid blocks or gradient fills)
- Theme selector dropdown shows preview samples or swatches for each available theme
- Hue slider provides real-time preview of color adjustments across current theme
- Theme preview cards update dynamically as hue is adjusted
- **Improved Spacing**: Normalized vertical rhythm with consistent ~24px section gaps and better spacing throughout the admin panel
- **Enhanced Form Elements**: All form controls styled with translucent panels and theme-appropriate gradient outlines

#### Acceptance Criteria
- **Fix**: Admin panel loads properly without blank screen when clicking "Admin" button
- Changing category thresholds displays preview modal showing affected assets before confirmation
- Decimal precision changes reflect consistently across all UI components immediately
- Theme settings apply in real-time with proper contrast and accessibility maintained using theme tokens
- All settings persist across browser sessions and page reloads including theme selection and hue adjustment
- JSON export produces complete application backup including theme settings and exit ladder configurations that can be imported successfully
- CSV exports generate readable files with proper headers for non-technical users
- Import preview shows clear diff comparison with validation errors highlighted using theme colors
- Confirming import applies only valid data and updates all related calculations
- **Fix**: UI preferences control default table appearance with all columns visible except "Exit Ladder" and "Notes"
- All components use selected theme styling consistently with atmospheric layered gradient backgrounds and no solid blocks or gradient fills
- **Enhanced Action Buttons**: All buttons use elegant gradient-outline pill design with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- Theme selector dropdown allows switching between all predefined themes with immediate application
- Hue slider remaps accent and gradient colors in real-time across selected theme
- Theme preview cards show accurate representation of each theme with current hue setting
- Selected theme and hue adjustment persist across browser sessions and are restored on startup
- **Refined Visual Design**: All admin panel sections use improved spacing rhythm and enhanced form styling
- **Micro-animations**: Smooth transitions and hover effects with reduced-motion support

### Performance Optimization Features
- **React Performance**: Implement `React.memo` for heavy components (`PortfolioTable`, `AllocationChart`, `PortfolioDashboard`) to prevent unnecessary re-renders
- **Memoization**: Use `useMemo` for expensive calculations like portfolio totals, categorization, and chart data processing
- **Throttling**: Throttle real-time updates and animation triggers from price services to maximum 1 update per 1-2 seconds
- **Efficient Data Updates**: Use `structuredClone` or shallow patches for data updates instead of deep object rebuilds
- **Chart Optimization**: Limit Recharts redraw rate to at most 1 update every 1-2 seconds instead of every tick
- **Animation Performance**: Use CSS transitions instead of React state updates for animations where possible
- **Hardware Acceleration**: Apply `will-change`, `transform`, and hardware acceleration hints for smoother animations
- **Deferred Computations**: Use `requestIdleCallback` for expensive computations like totals and categorization
- **Cached Calculations**: Cache results of repetitive calculations in the data model (category thresholds, totals)
- **Virtualization**: Implement `react-window` for long tables if applicable
- **Batch Updates**: Batch animation updates to prevent excessive re-renders during rapid price changes
- **Performance Monitoring**: Add simple FPS and update frequency logging to console for performance verification
- **Reduced Motion**: Ensure all animations respect `prefers-reduced-motion` accessibility settings

### Initial Mock Data Population
- On first application load, display a pre-populated portfolio with mock data representing blue chip, mid cap, and low cap assets (e.g., SOL, ETH, BTC, RENDER, ONDO, KMNO, etc.)
- Generate realistic historical performance data for charts spanning 1 year
- Include comprehensive mock market data for the Market tab with diverse cryptocurrency assets
- Generate mock transaction history including both buy and sell transactions for realized P&L demonstration
- **Enhanced Action Button**: Display a "Clear Mock Data" button at the top of the portfolio dashboard styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- When clicked, the button clears all mock data, resets the portfolio to empty state, and disappears permanently
- Portfolio table, charts, and totals update immediately after clearing with smooth animations
- Use localStorage to persist the cleared state so the button does not reappear on reload
- Application content language: English
- Application loads in two-pane expanded mode as the default and only layout mode
- All mock data displays use selected theme styling with atmospheric layered gradient backgrounds and no solid blocks or gradient fills
- Default theme on first load: Midnight Neon with neutral hue setting

### Portfolio Management
- Users can add crypto holdings by entering ticker symbol and token quantity using unified modal with transparent interiors and theme-appropriate gradient outlines
- Alternative entry method: specify dollar amount to automatically calculate token quantity based on current price
- **Enhanced Action Button**: "Use Current Price" button styled as elegant gradient-outline pill with soft cyan→violet border, transparent interior, and refined glow feedback on hover with 150ms ease-out transitions in unified Add/Edit Asset modal fetches real-time price with fallback to cached price and auto-fills average cost field correctly (no solid fills)
- Display portfolio positions with real-time price updates from CoinGecko API using translucent panels with smooth update animations (no solid blocks)
- Allow reordering of positions by total value (highest to lowest)
- Export portfolio data to spreadsheet format
- Log partial and full sales with automatic realized P&L calculation using forms with translucent panels and theme-appropriate gradient outlines
- Track exit ladder hits and enable batch sale processing with buttons styled as elegant gradient-outline pills with soft cyan→violet borders, transparent interiors, and refined glow feedback on hover with 150ms ease-out transitions (no solid fills)
- Maintain separate unrealized and realized P&L tracking with tabs styled using translucent panels
- **Position Merging**: Unified modal handles position merging using weighted average cost calculation and preserves existing metadata
- **Weighted Average Cost**: Calculate new average cost using formula: newAvgCost = ((oldAvgCost * oldTokens) + (purchaseCost * newTokens)) / (oldTokens + newTokens)
- Preserve existing holding metadata (lockedCategory, notes) when merging positions
- All management interfaces styled consistently with selected theme with smooth animations and atmospheric layered gradient backgrounds (no solid blocks or gradient fills)

### Portfolio Visualization
- Interactive allocation donut chart showing portfolio allocation by category styled with selected theme colors, gradient line strokes, reduced gridline opacity, feathered chart edges, elegant tooltip styling, and smooth update animations (no solid blocks)
- Category trend small multiples for detailed category analysis with translucent panels, gradient line strokes, reduced gridline opacity, feathered chart edges, elegant tooltip styling, and smooth animations (no solid blocks)
- Analytics KPI cards as four full-width rectangular tiles in a single row for key performance metrics using transparent interiors and theme-appropriate gradient outlines with animated value changes (150-180ms fade/scale transitions)
- Realized vs Unrealized P&L visualization with tabbed interface using translucent panels (no solid blocks)
- All charts and visualizations consistently apply selected theme colors and styling with smooth fade-and-scale transitions (150-180ms), atmospheric layered gradient backgrounds, gradient line strokes, reduced gridline opacity, feathered chart edges, elegant tooltip styling, and no solid blocks or gradient fills
- **Performance Optimization**: Charts update at maximum 1 update per 1-2 seconds with hardware acceleration for smooth 60fps animations

## Data Storage
The backend must store:
- User authentication state and Internet Identity integration data
- User portfolio holdings (ticker, quantity, purchase data, average cost)
- Portfolio performance history snapshots for chart generation
- Market data cache for discovery features (symbols, prices, market caps, volumes)
- Admin panel settings (theme preferences including selected theme name and hue adjustment, number formatting, category thresholds, price provider configuration)
- Time-series data for performance tracking and analytics
- Complete application state backups for import/export functionality
- Transaction history for comprehensive portfolio tracking including realized P&L
- Schema version information for data migration support
- UI preferences (table density, column visibility with default all visible except "Exit Ladder" and "Notes", sidebar width)
- Exit ladder configurations and hit tracking data with real-time synchronization between Portfolio and Exit Strategy pages
- Per-asset exit ladder configurations including preset types (Conservative, Aggressive, Custom) and custom rung data
- Custom exit ladder configurations that persist until preset changes
- Realized and unrealized P&L calculations and history
- Weighted average cost calculations for merged positions
- Theme configuration and styling preferences including predefined theme selection and hue adjustments
- Authentication session management and user identity data
- Default Blue Chip Conservative ladder preset with proper rungs (10% at 1.2×, 20% at 1.4×, 25% at 1.8×, 40% at 2.0×, 5% remaining)

## External Integration
- Internet Identity authentication system for secure user access
- Real-time cryptocurrency price data from CoinGecko API and CryptoRates.ai API
- Market data for volume, market cap, and performance metrics
- Market discovery data for top-volume feed and screener functionality
- Real-time price fetching with fallback to cached prices for "Use Current Price" functionality in unified Add/Edit Asset modal
