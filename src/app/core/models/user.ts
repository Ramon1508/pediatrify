import { Timestamp } from 'firebase/firestore';
import { Sexo } from './sexo';

export type UserRole = 'admin' | 'employee';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  firebaseUid?: string;
  pending?: boolean;
  sexo?: Sexo;
  phone?: string;
  phoneVerified?: boolean;
  especialidad?: string;
  cedula?: string;
  cedulaEspecialidad?: string;
  consultorios?: string;
  logoPath?: string;
  profileComplete?: boolean;
  photoURL?: string;
  consultationDuration?: number;
  allowPatientScheduling?: boolean;
  availableDays?: string[];
  startTime?: string;
  endTime?: string;
  timeSegments?: TimeSegment[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Patient {
  id: string;
  name: string;
  lastName: string;
  birthDate: string;
  email: string;
  secondaryEmail?: string;
  fatherName: string;
  motherName: string;
  phone: string;
  otpPassword: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimeSegment {
  startTime: string;
  endTime: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  performedByUid: string;
  timestamp: Timestamp;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'scheduled' | 'attended' | 'cancelled';
  type: 'scheduled' | 'walk-in';
  notes?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
  disabled?: boolean;
}

export type SessionUser =
  | { type: 'doctor'; user: AppUser }
  | { type: 'patient'; patient: Patient }
  | null;
