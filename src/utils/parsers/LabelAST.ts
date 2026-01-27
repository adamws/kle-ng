/**
 * LabelAST - AST type definitions for parsed HTML labels
 *
 * This module defines the lightweight AST structure used by LabelParser
 * to represent parsed HTML content. The AST supports text styling,
 * links, images, and inline SVGs.
 */

/**
 * Text styling options
 */
export interface TextStyle {
  bold?: boolean
  italic?: boolean
}

/**
 * Plain text node with optional styling
 */
export interface TextNode {
  type: 'text'
  text: string
  style: TextStyle
}

/**
 * Hyperlink node
 */
export interface LinkNode {
  type: 'link'
  href: string
  text: string
  style: TextStyle
}

/**
 * External image node
 */
export interface ImageNode {
  type: 'image'
  src: string
  width?: number
  height?: number
}

/**
 * Inline SVG node
 */
export interface SVGNode {
  type: 'svg'
  content: string
  width?: number
  height?: number
}

/**
 * List item node - contains text content and optional nested lists
 * NOTE: Images/SVGs are NOT supported in list items (text-only content)
 */
export interface ListItemNode {
  type: 'list-item'
  children: LabelNode[] // Text content only: text, links, nested lists
}

/**
 * List node - ordered or unordered list container
 */
export interface ListNode {
  type: 'list'
  ordered: boolean // true = <ol>, false = <ul>
  items: ListItemNode[]
}

/**
 * Union type of all possible label nodes
 */
export type LabelNode = TextNode | LinkNode | ImageNode | SVGNode | ListNode | ListItemNode

/**
 * Type guard for TextNode
 */
export function isTextNode(node: LabelNode): node is TextNode {
  return node.type === 'text'
}

/**
 * Type guard for LinkNode
 */
export function isLinkNode(node: LabelNode): node is LinkNode {
  return node.type === 'link'
}

/**
 * Type guard for ImageNode
 */
export function isImageNode(node: LabelNode): node is ImageNode {
  return node.type === 'image'
}

/**
 * Type guard for SVGNode
 */
export function isSVGNode(node: LabelNode): node is SVGNode {
  return node.type === 'svg'
}

/**
 * Type guard for ListNode
 */
export function isListNode(node: LabelNode): node is ListNode {
  return node.type === 'list'
}

/**
 * Check if a node is an inline node (text or link)
 * Lists and list items are NOT inline - they are block-level elements
 */
export function isInlineNode(node: LabelNode): node is TextNode | LinkNode {
  return node.type === 'text' || node.type === 'link'
}

/**
 * Create an empty text style
 */
export function emptyStyle(): TextStyle {
  return {}
}

/**
 * Merge two text styles (second takes precedence)
 */
export function mergeStyles(base: TextStyle, override: TextStyle): TextStyle {
  return { ...base, ...override }
}
