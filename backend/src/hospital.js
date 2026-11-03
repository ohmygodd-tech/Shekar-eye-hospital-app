// ─────────────────────────────────────────────────────────────────────────────
// Hospital profile — the single place to put Shekar Eye Hospital's real details.
// Values marked TODO are placeholders: replace them before going live.
// The mobile app and admin panel fetch this from GET /api/hospital.
// ─────────────────────────────────────────────────────────────────────────────
export const hospital = {
  name: 'Shekar Eye Hospital',
  shortName: 'Shekar Eye',
  tagline: 'Caring for your vision',
  phone: process.env.HOSPITAL_PHONE || '+91-00000-00000',            // TODO real reception number
  emergencyPhone: process.env.HOSPITAL_EMERGENCY_PHONE || '+91-00000-00000', // TODO 24x7 eye emergency
  whatsapp: process.env.HOSPITAL_WHATSAPP || '',                       // TODO optional
  email: process.env.HOSPITAL_EMAIL || 'info@example.com',             // TODO
  website: process.env.HOSPITAL_WEBSITE || '',                         // TODO
  address: process.env.HOSPITAL_ADDRESS || 'Address to be updated, Bengaluru, Karnataka', // TODO
  mapsUrl: process.env.HOSPITAL_MAPS_URL || '',                        // TODO Google Maps link
  gstin: process.env.HOSPITAL_GSTIN || '',
  timings: [
    { days: 'Mon – Sat', hours: '9:00 AM – 7:00 PM' },  // TODO confirm
    { days: 'Sunday', hours: '9:00 AM – 1:00 PM' },     // TODO confirm
  ],
  insurance: 'Cashless treatment available with major insurers and TPAs. Please contact the front desk with your policy details.', // TODO confirm
  brand: { primary: '#0B6E99', secondary: '#13A89E', accent: '#F4A72C' },
};
