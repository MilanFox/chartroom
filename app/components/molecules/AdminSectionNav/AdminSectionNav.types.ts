import type { AdminSectionId } from '~/utils/paths';

export interface AdminSectionNavProps {
  sections: { id: AdminSectionId, label: string }[]
}
