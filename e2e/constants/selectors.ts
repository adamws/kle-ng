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
} as const
