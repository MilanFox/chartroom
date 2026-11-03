type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface DemoButtonProps {
  label?: string
  size?: ButtonSize
  variant?: ButtonVariant
  disabled?: boolean
}
