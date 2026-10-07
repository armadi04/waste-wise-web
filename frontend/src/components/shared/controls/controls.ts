import {
  Autocomplete as HeroAutocomplete,
  AutocompleteItem as HeroAutocompleteItem,
  Button as HeroButton,
  Checkbox as HeroCheckbox,
  Chip as HeroChip,
  Drawer as HeroDrawer,
  Dropdown as HeroDropdown,
  DropdownItem as HeroDropdownItem,
  Input as HeroInput,
  Modal as HeroModal,
  Pagination as HeroPagination,
  Popover as HeroPopover,
  Select as HeroSelect,
  SelectItem as HeroSelectItem,
  Snippet as HeroSnippet,
  Switch as HeroSwitch,
  Tabs as HeroTabs,
  Textarea as HeroTextarea,
  Tooltip as HeroTooltip,
  extendVariants,
} from '@heroui/react'

export const Button = extendVariants(HeroButton, {
  variants: {
    color: {
      default: 'app-button app-tone-default',
      primary: 'app-button app-tone-primary',
      secondary: 'app-button app-tone-secondary',
      success: 'app-button app-tone-success',
      warning: 'app-button app-tone-warning',
      danger: 'app-button app-tone-danger',
    },
    variant: {
      solid: 'app-solid',
      bordered: 'app-bordered',
      light: 'app-light',
      flat: 'app-flat',
      faded: 'app-faded',
      ghost: 'app-ghost',
      shadow: 'app-shadow',
    },
  },
  defaultVariants: { color: 'default', variant: 'solid' },
}) as typeof HeroButton

export const Input = extendVariants(HeroInput, {
  slots: {
    base: 'app-field',
    inputWrapper: 'app-field-control',
    input: 'app-field-text',
    label: 'app-field-label',
    errorMessage: 'app-field-error',
  },
}) as typeof HeroInput

export const Textarea = extendVariants(HeroTextarea, {
  slots: {
    base: 'app-field',
    inputWrapper: 'app-field-control',
    input: 'app-field-text',
    label: 'app-field-label',
    errorMessage: 'app-field-error',
  },
}) as typeof HeroTextarea

export const Select = extendVariants(HeroSelect, {
  slots: {
    base: 'app-field',
    trigger: 'app-field-control',
    value: 'app-field-text',
    label: 'app-field-label',
    errorMessage: 'app-field-error',
    popoverContent: 'app-overlay',
  },
}) as typeof HeroSelect

export const Autocomplete = extendVariants(HeroAutocomplete, {
  slots: {
    base: 'app-field',
    popoverContent: 'app-overlay',
  },
}) as typeof HeroAutocomplete

export const Chip = extendVariants(HeroChip, {
  variants: {
    color: {
      default: { base: 'app-chip app-tone-default' },
      primary: { base: 'app-chip app-tone-primary' },
      secondary: { base: 'app-chip app-tone-secondary' },
      success: { base: 'app-chip app-tone-success' },
      warning: { base: 'app-chip app-tone-warning' },
      danger: { base: 'app-chip app-tone-danger' },
    },
    variant: {
      solid: { base: 'app-solid' },
      bordered: { base: 'app-bordered' },
      light: { base: 'app-light' },
      flat: { base: 'app-flat' },
      faded: { base: 'app-faded' },
      shadow: { base: 'app-shadow' },
      dot: { base: 'app-dot' },
    },
  },
  defaultVariants: { color: 'default', variant: 'flat' },
}) as typeof HeroChip

export const DropdownItem = extendVariants(HeroDropdownItem, {
  variants: {
    color: {
      default: { base: 'app-dropdownitem app-tone-default' },
      primary: { base: 'app-dropdownitem app-tone-primary' },
      secondary: { base: 'app-dropdownitem app-tone-secondary' },
      success: { base: 'app-dropdownitem app-tone-success' },
      warning: { base: 'app-dropdownitem app-tone-warning' },
      danger: { base: 'app-dropdownitem app-tone-danger' },
    },
    variant: {
      solid: { base: 'app-solid' },
      bordered: { base: 'app-bordered' },
      light: { base: 'app-light' },
      flat: { base: 'app-flat' },
      faded: { base: 'app-faded' },
      shadow: { base: 'app-shadow' },
      dot: { base: 'app-dot' },
    },
  },
  defaultVariants: { color: 'default', variant: 'flat' },
}) as typeof HeroDropdownItem

export const Modal = extendVariants(HeroModal, {
  defaultVariants: { backdrop: 'blur' },
  slots: {
    backdrop: 'app-backdrop',
    base: 'app-overlay',
    closeButton: 'app-neutral-control',
  },
}) as typeof HeroModal

export const Drawer = extendVariants(HeroDrawer, {
  defaultVariants: { backdrop: 'blur' },
  slots: {
    backdrop: 'app-backdrop',
    base: 'app-overlay',
    closeButton: 'app-neutral-control',
  },
}) as typeof HeroDrawer

export const Popover = extendVariants(HeroPopover, {
  slots: {
    content: 'app-overlay',
  },
}) as typeof HeroPopover

export const Dropdown = extendVariants(HeroDropdown, {
  slots: {
    content: 'app-overlay',
  },
}) as typeof HeroDropdown

export const Tooltip = extendVariants(HeroTooltip, {
  slots: {
    content: 'app-overlay',
  },
}) as typeof HeroTooltip

export const Checkbox = extendVariants(HeroCheckbox, {
  slots: {
    base: 'app-choice',
    wrapper: 'app-choice-control',
    label: 'app-field-label',
  },
}) as typeof HeroCheckbox

export const Switch = extendVariants(HeroSwitch, {
  slots: {
    base: 'app-choice',
    wrapper: 'app-switch',
    thumb: 'app-switch-thumb',
    label: 'app-field-label',
  },
}) as typeof HeroSwitch

export const Pagination = extendVariants(HeroPagination, {
  slots: {
    base: 'app-pagination',
    item: 'app-neutral-control',
    cursor: 'app-pagination-cursor',
    prev: 'app-neutral-control',
    next: 'app-neutral-control',
  },
}) as typeof HeroPagination

export const Snippet = extendVariants(HeroSnippet, {
  variants: {
    color: {
      default: { base: 'app-snippet app-tone-default' },
      primary: { base: 'app-snippet app-tone-primary' },
      secondary: { base: 'app-snippet app-tone-secondary' },
      success: { base: 'app-snippet app-tone-success' },
      warning: { base: 'app-snippet app-tone-warning' },
      danger: { base: 'app-snippet app-tone-danger' },
    },
    variant: {
      solid: { base: 'app-solid' },
      bordered: { base: 'app-bordered' },
      light: { base: 'app-light' },
      flat: { base: 'app-flat' },
      faded: { base: 'app-faded' },
      shadow: { base: 'app-shadow' },
      dot: { base: 'app-dot' },
    },
  },
  defaultVariants: { color: 'default', variant: 'flat' },
}) as typeof HeroSnippet

export const SelectItem = extendVariants(HeroSelectItem, {
  slots: { base: 'app-option' },
}) as typeof HeroSelectItem

export const AutocompleteItem = extendVariants(HeroAutocompleteItem, {
  slots: { base: 'app-option' },
}) as typeof HeroAutocompleteItem

export const Tabs = extendVariants(HeroTabs, {
  slots: { base: 'app-tabs' },
}) as typeof HeroTabs
