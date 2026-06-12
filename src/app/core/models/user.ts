import { Timestamp } from 'firebase/firestore';
import { Sexo } from './sexo';
import { PrintSettings } from './print-settings';

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
  printSettings?: PrintSettings;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface VaccineDose {
  applied: boolean;
  applicationDate?: string;
  batchNumber?: string;
  institution?: string;
  notes?: string;
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
  secondaryPhone?: string;
  referredBy?: string;
  otpPassword: string;
  profileComplete?: boolean;
  bloodType?: string;
  birthWeight?: number;
  birthHeight?: number;
  headCircumference?: number;
  sex?: Sexo;
  birthMethod?: 'vaginal' | 'cesarean';
  hasAllergies?: boolean;
  allergies?: string;
  hasBeenHospitalized?: boolean;
  hospitalizationReason?: string;
  hasDisease?: boolean;
  diseaseDescription?: string;
  takesMedication?: boolean;
  medicationDescription?: string;
  vaccinationRecord?: Record<string, Record<string, VaccineDose>>;
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
  patientLastName: string;
  patientFatherName: string;
  patientMotherName: string;
  patientBirthDate: string;
  patientPhone: string;
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
