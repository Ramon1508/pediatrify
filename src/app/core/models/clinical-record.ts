export interface ClinicalRecord {
  id: string;
  patientId: string;
  date: string;
  motivoConsulta: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}
