import type { IconName } from './ui';
import type { MedicalRecord } from '@/lib/types';

export const RECORD_META: Record<MedicalRecord['type'], { label: string; icon: IconName }> = {
  eye_test: { label: 'Eye test', icon: 'eye-outline' },
  spectacle_rx: { label: 'Glasses prescription', icon: 'glasses-outline' },
  prescription: { label: 'Prescription', icon: 'medkit-outline' },
  lab_report: { label: 'Lab report', icon: 'flask-outline' },
  scan: { label: 'Scan', icon: 'scan-outline' },
  discharge_summary: { label: 'Discharge summary', icon: 'clipboard-outline' },
  other: { label: 'Document', icon: 'document-outline' },
};
