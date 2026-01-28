# Prompt to Claude: Portfolio page space + Columns menu bug + "Nearest Exits" widget

## Context
We're working in the Yieldschool Portfolio Tracker React UI (Portfolio page with category groups like Cash & Stablecoins, Blue Chip, Mid Cap, etc.). We have a table with optional columns controlled by a "Columns" dropdown menu. Right now:
- The Actions column is too wide and forces wrapping when many columns are enabled.
- The action icons are inside circles and laid out horizontally, wasting space.
- The % change column shows "24h change" text below the percentage, which is redundant and takes space.
- The Columns dropdown menu closes every time a checkbox is toggled, which is annoying. It should stay open until the user clicks outside.
- Default visible columns should be adjusted.
- There is a placeholder Exit plan summary card below Allocation overview that we want to replace with a useful widget.

## Goals
1) Save horizontal space in the table so rows fit on one line even with many columns enabled.
2) Improve column menu usability and set better defaults.
3) Replace the existing "Exit plan overview" card below Allocation overview with a compact "Nearest Exits" widget (Option A concept).

## Work items

### A) Actions column: reduce width and prevent wrapping
- Update the Actions column UI so the two action buttons (edit + delete) are NOT in large circular buttons.
- Stack the icons vertically (edit on top, delete below).
- Remove the circle backgrounds and use compact icon buttons (hover/focus states are fine).
- Reduce the Actions column width to only what is necessary to fit the stacked icons (no extra padding).
- Ensure actions never wrap to a new line. The column should stay compact even when all other columns are enabled.
- Keep tooltips or accessible labels for the icons (so icon-only controls are still understandable).

### B) % change column: remove redundant label under the value
- Right now the cell shows a percentage with small text below like "24h change". Remove the small text in each row to save space.
- For now, keep the column header as "24H" (or "24h change", whichever is already in the header). The cell should only show the percent value.
- Optional small improvement: style the percentage so it is visually self-explanatory even without the text (e.g., green for positive, red for negative). If there is already a theme token for success/danger, use it. If not, keep neutral for now, but still remove the redundant "24h change" line.
- We may later add up/down triangles like CoinGecko, but do not add that yet unless it is trivial.

### C) Columns menu: fix bug where it closes on toggle
- Current behavior: when clicking any checkbox in the Columns dropdown, the menu closes immediately.
- Desired behavior: menu stays open while toggling checkboxes; it only closes when clicking outside or pressing Escape.
- Implement this properly by preventing the dropdown from treating checkbox clicks as "select then close."
- Ensure keyboard accessibility still works.

### D) Columns default state
- Change the default visible columns so that ALL columns are enabled by default EXCEPT "% Change".
- The default should include: Price, Tokens, Value, Share, Avg Cost, Exit Ladder, Notes, Actions.
- % Change should be off by default.

### E) Notes header
- Ensure the Notes column has a proper header label (it currently appears to be missing).

### F) Replace Exit plan overview card with "Nearest Exits" widget under Allocation overview
- Remove the existing "Exit plan overview" card below the Allocation overview.
- Replace it with a new compact card titled "Nearest Exits".
- Purpose: show the next 3–5 closest upcoming exit targets across the portfolio (only positions that have an exit ladder configured).
- Sort by "distance to next target" (closest first). Use percent-away if possible, or absolute distance if that's easier.
- Each line should include:
  - Asset symbol
  - Next target price (the next rung price)
  - Distance to target (e.g., "12% away")
  - Optional: tokens to sell on that rung if it fits cleanly, but prioritize clarity.
- If no ladders exist, show a simple empty state message like "No exit plans set yet."
- Keep the widget calm and compact, matching the existing dark premium style. No loud CTA. If you include an action, keep it subtle (e.g., "Set plan" link).

## Implementation notes
- Do not change the underlying portfolio math or ladder math unless needed.
- Keep styling consistent with existing components and theme tokens.
- Ensure the table remains readable at normal desktop widths and does not require horizontal scrolling for the common default layout.
- After the changes, verify:
  1) With all default columns enabled (everything except % change), the row stays one line and the Actions column does not force wrapping.
  2) Toggling multiple checkboxes in the Columns menu does not close the menu.
  3) Notes header appears correctly.
  4) Nearest Exits widget renders correctly with and without any configured exit ladders.
