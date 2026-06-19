export interface ClinicalRecord {
  id: string;
  patientId: string;
  date: string;
  headCircumference?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  saturation?: number;
  temperature?: number;
  motivoConsulta: string;
  diagnosis?: string;
  notas?: string;
  recommendations?: string;
  visibleUntil?: string;
  prescription?: string;
  visibleUntilRx?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}
