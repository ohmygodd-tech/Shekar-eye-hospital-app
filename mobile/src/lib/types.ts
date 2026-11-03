export type Role = 'patient' | 'doctor' | 'receptionist' | 'admin';

export interface User { id: string; phone: string; name: string | null; email: string | null; role: Role; consentAt: string | null }

export interface Patient {
  id: string; mrn: string; name: string; relation: string; dob: string | null;
  gender: 'male' | 'female' | 'other' | null; bloodGroup: string | null; allergies: string | null;
  medicalHistory: string | null; wearsGlasses: boolean | null;
}

export interface Department { id: string; slug: string; name: string; description: string; icon: string; doctorCount: number }

export interface Doctor {
  id: string; name: string; qualification: string | null; experienceYears: number | null; languages: string[];
  bio: string | null; photoUrl: string | null; feePaise: number;
  department: { id: string; slug: string; name: string };
  schedule?: { weekday: number; start: string; end: string; slotMinutes: number }[];
}

export interface Slot { start: string; end: string; available: boolean }

export type ApptStatus = 'pending_payment' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string; date: string; startTime: string; endTime: string; status: ApptStatus;
  paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'pay_at_hospital'; feePaise: number;
  visitType: string; reason: string | null; tokenNo: number | null; holdExpiresAt: string | null;
  cancelReason: string | null; canChange?: boolean;
  patient: { id: string; name: string; mrn: string; relation: string };
  doctor: { id: string; name: string; qualification: string | null; photoUrl: string | null; department: string; departmentSlug: string };
}

export interface PaymentOrder { orderId: string; amountPaise: number; currency: string; provider: 'razorpay' | 'mock'; keyId: string; name: string }

export interface EyeSide { sph?: number; cyl?: number; axis?: number; add?: number; va?: string; iop?: number }
export interface MedicalRecord {
  id: string; type: 'eye_test' | 'spectacle_rx' | 'prescription' | 'lab_report' | 'scan' | 'discharge_summary' | 'other';
  title: string; notes: string | null; hasFile: boolean; fileName: string | null; mimeType: string | null; createdAt: string;
  uploadedBy: string | null; patient: { id: string; name: string; mrn: string };
  data: {
    od?: EyeSide; os?: EyeSide; pd?: number; diagnosis?: string; followUpDate?: string;
    medicines?: { name: string; eye?: string; dose?: string; frequency?: string; duration?: string }[];
  } | null;
}

export interface Hospital {
  name: string; shortName: string; tagline: string; phone: string; emergencyPhone: string; whatsapp: string;
  email: string; website: string; address: string; mapsUrl: string; timings: { days: string; hours: string }[];
  insurance: string; booking: { maxDaysAhead: number; cancelCutoffHours: number; holdMinutes: number };
  paymentProvider: 'razorpay' | 'mock' | 'none';
}

export interface Notification { id: string; title: string; body: string; readAt: string | null; createdAt: string; data: Record<string, string> | null }

export interface Payment {
  id: string; amountPaise: number; status: 'paid' | 'refunded'; receiptNo: string; paidAt: string; provider: string;
  appointmentId: string; date: string; doctorName: string; patientName: string;
}

export interface TriageResult {
  urgency: 'emergency' | 'soon' | 'routine'; title: string; advice: string[]; department: string;
  alternatives?: string[]; disclaimer: string; emergencyPhone: string;
  departmentInfo: { id: string; slug: string; name: string } | null;
}
