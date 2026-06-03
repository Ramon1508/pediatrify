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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Patient {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  otpPassword: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
}

export type SessionUser =
  | { type: 'doctor'; user: AppUser }
  | { type: 'patient'; patient: Patient }
  | null;
