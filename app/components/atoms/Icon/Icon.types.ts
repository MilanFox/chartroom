import type { ICON_PATHS } from './Icon.paths';

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName
  size?: number
}
