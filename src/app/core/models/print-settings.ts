export type PaperSize = 'media-carta' | 'carta' | 'oficio' | 'custom';
export type LogoPosition = 'top-left' | 'top-right';

export interface PrintSettings {
  paperSize: PaperSize;
  customWidth?: number;
  customHeight?: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  usePreloadedLogo: boolean;
  logoUrl?: string;
  logoPosition: LogoPosition;
  logoWidth: number;
  showDoctorName: boolean;
  showSpecialty: boolean;
  showProfessionalId: boolean;
  showSpecialtyId: boolean;
  showDoctorPhone: boolean;
  showDoctorOffice: boolean;
  showPatientName: boolean;
  showConsultDate: boolean;
  showPatientAge: boolean;
  showPatientWeight: boolean;
  showPatientHeight: boolean;
  showPatientHeadCircumference: boolean;
  showPatientTemperature: boolean;
}

export const PAPER_SIZES: { value: PaperSize; label: string; width: number; height: number }[] = [
  { value: 'media-carta', label: 'Media carta (21.5 x 14 cm)', width: 21.5, height: 14 },
  { value: 'carta', label: 'Carta (28 x 21.5 cm)', width: 28, height: 21.5 },
  { value: 'oficio', label: 'Oficio (33 x 21.5 cm)', width: 33, height: 21.5 },
];

export function getDefaultSettings(): PrintSettings {
  return {
    paperSize: 'media-carta',
    marginTop: 1,
    marginBottom: 1,
    marginLeft: 1,
    marginRight: 1,
    usePreloadedLogo: true,
    logoPosition: 'top-left',
    logoWidth: 5,
    showDoctorName: true,
    showSpecialty: true,
    showProfessionalId: true,
    showSpecialtyId: true,
    showDoctorPhone: true,
    showDoctorOffice: true,
    showPatientName: true,
    showConsultDate: true,
    showPatientAge: true,
    showPatientWeight: true,
    showPatientHeight: true,
    showPatientHeadCircumference: true,
    showPatientTemperature: true,
  };
}

export function getPaperDimensions(size: PaperSize, customWidth?: number, customHeight?: number): { width: number; height: number } {
  const preset = PAPER_SIZES.find((s) => s.value === size);
  if (preset) return { width: preset.width, height: preset.height };
  return { width: customWidth ?? 21.5, height: customHeight ?? 14 };
}
