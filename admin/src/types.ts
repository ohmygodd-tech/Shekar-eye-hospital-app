export type Role = 'admin' | 'receptionist' | 'doctor' | 'patient';
export interface Me { user: { id: string; name: string | null; phone: string; role: Role }; doctorId: string | null }
export interface Department { id: string; slug: string; name: string; description: string | null; icon: string | null; sortOrder: number; isActive: boolean }
export interface Doctor {
  id: string; name: string; qualification: string | null; experienceYears: number | null; languages: string[]; bio: string | null;
  photoUrl: string | null; feePaise: number; isActive: boolean; phone: string | null;
  department: { id: string; slug: string; name: string };
  schedule: { weekday: number; start: string; end: string; slotMinutes: number }[];
  leaves: { date: string; reason: string | null }[];
}
export interface Appt {
  id: string; date: string; startTime: string; endTime: string; status: string; paymentStatus: string; feePaise: number;
  visitType: string; reason: string | null; tokenNo: number | null; phone?: string;
  patient: { id: string; name: string; mrn: string; relation: string };
  doctor: { id: string; name: string; department: string };
}
export interface PatientRow { id: string; mrn: string; name: string; relation: string; dob: string | null; gender: string | null; phone: string; createdAt: string; lastVisit: string | null }
export interface Rec { id: string; type: string; title: string; notes: string | null; data: any; hasFile: boolean; fileName: string | null; createdAt: string; uploadedBy: string | null }
