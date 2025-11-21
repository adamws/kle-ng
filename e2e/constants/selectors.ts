/**
 * Centralized selectors for UI elements
 *
 * This file contains all selectors used in tests. When the UI changes,
 * update selectors here rather than in individual tests.
 *
 * TODO: Replace with data-testid selectors once added to application
 */

export const SELECTORS = {
  /**
   * Canvas toolbar buttons
   */
  TOOLBAR: {
    ADD_KEY: 'button[title="Add Standard Key"]',
    DELETE_KEYS: 'button[title="Delete Keys"]',
    UNDO: 'button[title="Undo"]',
    REDO: 'button[title="Redo"]',
    ROTATE_SELECTION: 'button[title="Rotate Selection"]',
    MIRROR_VERTICAL: 'button[title="Mirror Vertical"]',
    MOVE_EXACTLY: 'button[title="Move Exactly"]',
  },

  /**
   * Status counters
   */
  COUNTERS: {
    KEYS: '.keys-counter',
    SELECTED: '.selected-counter',
  },

  /**
   * Canvas and rendering
   */
  CANVAS: {
    MAIN: '.keyboard-canvas',
    TOOLBAR: '.canvas-toolbar',
  },

  /**
   * Panels and sidebars
   */
  PANELS: {
    PROPERTIES: '.key-properties-panel',
    TOOLBAR_CONTAINER: '.toolbar-container',
  },

  /**
   * Key label inputs (9-grid layout)
   */
  LABELS: {
    GRID: '.labels-grid',
    INPUT: '.labels-grid .form-control',
  },

  /**
   * Import/Export
   */
  IMPORT_EXPORT: {
    IMPORT_BUTTON: 'button:has-text("Import")',
    EXPORT_BUTTON: 'button:has-text("Export")',
    FROM_FILE: 'a:has-text("From File")',
    DOWNLOAD_JSON: 'a:has-text("Download JSON")',
    DOWNLOAD_PNG: 'a:has-text("Download PNG")',
  },

  /**
   * Modals and dialogs
   */
  MODALS: {
    ROTATION_PANEL: '.rotation-panel',
    ROTATION_INFO: '.rotation-info',
    MATRIX_MODAL: '.matrix-modal',
    COLOR_PICKER_POPUP: '.color-picker-popup',
  },

  /**
   * Theme switching
   */
  THEME: {
    TOGGLE_BUTTON: 'button:has-text("Theme")',
    DROPDOWN_MENU: '.dropdown-menu',
  },

  /**
   * Miscellaneous
   */
  MISC: {
    UNSAVED_INDICATOR: '.text-warning:has-text("Unsaved changes")',
  },
} as const
