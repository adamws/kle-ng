/**
 * Centralized selectors for UI elements
 *
 * This file contains all selectors used in tests. When the UI changes,
 * update selectors here rather than in individual tests.
 */

export const SELECTORS = {
  /**
   * Canvas toolbar buttons
   */
  TOOLBAR: {
    ADD_KEY: '[data-testid="toolbar-add-key"]',
    DELETE_KEYS: '[data-testid="toolbar-delete-keys"]',
    UNDO: '[data-testid="toolbar-undo"]',
    REDO: '[data-testid="toolbar-redo"]',
    ROTATE_SELECTION: '[data-testid="toolbar-rotate-selection"]',
    MIRROR_VERTICAL: '[data-testid="toolbar-mirror-vertical"]',
    MOVE_EXACTLY: '[data-testid="toolbar-move-exactly"]',
  },

  /**
   * Status counters
   */
  COUNTERS: {
    KEYS: '[data-testid="counter-keys"]',
    SELECTED: '[data-testid="counter-selected"]',
  },

  /**
   * Canvas and rendering
   */
  CANVAS: {
    MAIN: '[data-testid="canvas-main"]',
    TOOLBAR: '[data-testid="canvas-toolbar"]',
  },

  /**
   * Panels and sidebars
   */
  PANELS: {
    PROPERTIES: '[data-testid="panel-properties"]',
    TOOLBAR_CONTAINER: '[data-testid="panel-toolbar-container"]',
  },

  /**
   * Key label inputs (9-grid layout)
   */
  LABELS: {
    GRID: '[data-testid="labels-grid"]',
    INPUT: '[data-testid="labels-grid"] .form-control',
  },

  /**
   * Import/Export
   */
  IMPORT_EXPORT: {
    IMPORT_BUTTON: '[data-testid="button-import"]',
    EXPORT_BUTTON: '[data-testid="button-export"]',
    FROM_FILE: '[data-testid="import-from-file"]',
    DOWNLOAD_JSON: '[data-testid="export-download-json"]',
    DOWNLOAD_PNG: '[data-testid="export-download-png"]',
  },

  /**
   * Modals and dialogs
   */
  MODALS: {
    ROTATION_PANEL: '[data-testid="modal-rotation-panel"]',
    ROTATION_INFO: '[data-testid="modal-rotation-info"]',
    MATRIX_MODAL: '[data-testid="modal-matrix"]',
    COLOR_PICKER_POPUP: '[data-testid="modal-color-picker"]',
  },

  /**
   * Theme switching
   */
  THEME: {
    TOGGLE_BUTTON: '[data-testid="theme-toggle-button"]',
    DROPDOWN_MENU: '[data-testid="theme-dropdown-menu"]',
  },

  /**
   * Miscellaneous
   */
  MISC: {
    UNSAVED_INDICATOR: '[data-testid="unsaved-changes-indicator"]',
  },

  /**
   * Preset dropdown
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  PRESET: {
    DROPDOWN: '.preset-dropdown',
    SELECT_BUTTON: '.preset-dropdown button.preset-select',
    DROPDOWN_ITEM: '.preset-dropdown .dropdown-item',
  },

  /**
   * Zoom control
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  ZOOM: {
    CONTROL: '.zoom-control',
    INPUT: '.zoom-control .custom-number-input input',
  },

  /**
   * Toast notifications
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  TOAST: {
    NOTIFICATION: '.toast.show',
    TITLE: '.toast-header strong',
    TEXT: '.toast-body',
    CLOSE: '.btn-close',
  },

  /**
   * Extra tools dropdown
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  EXTRA_TOOLS: {
    BUTTON: '.extra-tools-group > button',
    DROPDOWN: '.extra-tools-group .dropdown-menu',
    DROPDOWN_ITEM: '.extra-tools-group .dropdown-menu .dropdown-item',
  },

  /**
   * Move step control
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  MOVE_STEP: {
    CONTROL: '.move-step-control',
    INPUT: '.move-step-control .custom-number-input input',
  },

  /**
   * Summary tab and Key Center Positions
   * ⚠️ TECH DEBT: These selectors use CSS classes instead of data-testid.
   * Should be migrated to data-testid attributes in the future.
   */
  SUMMARY_TAB: {
    TAB_BUTTON: 'button.tab-btn:has-text("Summary")',
    KEY_CENTERS_TABLE: '.key-centers-table-container table',
    TABLE_ROW: '.key-centers-table-container table tbody tr',
    TABLE_CELL: '.key-centers-table-container table tbody td',
    UNITS_TOGGLE_U: 'label[for="centers-units-u"]',
    UNITS_TOGGLE_MM: 'label[for="centers-units-mm"]',
  },

  /**
   * Key Selection Popup - Overlapping key disambiguation
   */
  KEY_SELECTION_POPUP: {
    OVERLAY: '[data-testid="key-selection-overlay"]',
    POPUP: '[data-testid="key-selection-popup"]',
    HEADER: '[data-testid="key-selection-header"]',
    LIST: '[data-testid="key-selection-list"]',
    /** Use getItem(index) helper for specific items */
    ITEM_PREFIX: 'key-selection-item',
    ITEM_FOCUSED: '.popup-item--focused',
    KEY_COLOR: '[data-testid="key-selection-color"]',
    KEY_LABEL: '[data-testid="key-selection-label"]',
    KEY_INFO: '[data-testid="key-selection-info"]',
  },

  /**
   * Canvas Label Search
   *
   * The search bar is rendered with v-if (not v-show), so SEARCH_BAR is absent
   * from the DOM when closed. TRIGGER_BUTTON uses v-show so it is always present
   * but toggled between visible/hidden.
   *
   * ⚠️ TECH DEBT: TRIGGER_BUTTON and SEARCH_BAR use CSS classes / ARIA roles
   * instead of data-testid. Should be migrated to data-testid attributes.
   */
  SEARCH: {
    /** Magnifying-glass button shown when the search bar is closed. */
    TRIGGER_BUTTON: '.canvas-search-trigger',
    /** Root element of the search bar overlay (present only while open). */
    SEARCH_BAR: '[role="search"]',
    /** Text input inside the search bar (narrowed to input to avoid matching the trigger button). */
    INPUT: 'input[aria-label="Search key labels"]',
    /** Match count / "No matches" display span. */
    COUNT_DISPLAY: '.search-count',
    /** "Previous match" chevron button. */
    PREV_BUTTON: '[aria-label="Previous match"]',
    /** "Next match" chevron button. */
    NEXT_BUTTON: '[aria-label="Next match"]',
    /** "Close search" X button. */
    CLOSE_BUTTON: '[aria-label="Close search"]',
  },
  /**
   * Layout option toolbar (alternative layouts preview)
   */
  LAYOUT_OPTIONS: {
    TOOLBAR: '[data-testid="layout-option-toolbar"]',
    ALL_BUTTON: '[data-testid="layout-option-all"]',
    CHOICE_BUTTON: '[data-testid="layout-option-choice"]',
    PREVIEW_HINT: '[data-testid="layout-option-preview-hint"]',
    OPTION_GROUP: '[data-testid="layout-option-group"]',
  },

  /**
   * Plate Generator panel
   */
  PLATE_GENERATOR: {
    SECTION: '[data-section-id="plate"]',
    COLLAPSE_BTN: '[data-section-id="plate"] .collapse-btn',
    GENERATE_BTN: '[data-testid="plate-generate-btn"]',
    SVG_PREVIEW: '[data-testid="plate-svg-preview"]',
    IDLE_MESSAGE: '[data-testid="plate-idle-message"]',
    DOWNLOAD_SVG: '[data-testid="plate-download-svg"]',
    DOWNLOAD_DXF: '[data-testid="plate-download-dxf"]',
    TAB_OUTLINE: '[data-testid="plate-tab-outline"]',
    OUTLINE_TYPE_SELECT: '#outlineType',
    RESULTS_TAB_3D: '[data-testid="plate-results-tab-3d"]',
    THREE_CANVAS: '[data-testid="plate-3d-canvas"]',
  },
} as const
