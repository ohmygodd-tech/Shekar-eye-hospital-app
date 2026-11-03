// Seeds departments and SAMPLE doctors/staff so the app can be demoed.
// Replace sample doctors with Shekar Eye Hospital's real doctors from the admin panel before launch.
import { fileURLToPath } from 'node:url';
import { pool, tx } from './index.js';
import { migrate } from './migrate.js';

export const DEPARTMENTS = [
  ['general', 'General Ophthalmology', 'Comprehensive eye check-ups, vision testing, eye infections and general eye problems.', 'eye', 0],
  ['cataract', 'Cataract Services', 'Cataract evaluation and surgery, including modern lens (IOL) implants.', 'circle-dot', 1],
  ['retina', 'Retina & Vitreous', 'Diabetic retinopathy, retinal detachment, macular degeneration and retina injections.', 'scan-eye', 2],
  ['glaucoma', 'Glaucoma Clinic', 'Eye pressure checks, visual field tests and long-term glaucoma care.', 'gauge', 3],
  ['cornea', 'Cornea & Anterior Segment', 'Dry eye, infections, corneal ulcers, keratoconus and corneal transplant.', 'droplet', 4],
  ['refractive', 'LASIK & Refractive Surgery', 'Glasses and contact lens power, LASIK and other laser vision correction.', 'glasses', 5],
  ['pediatric', 'Paediatric Ophthalmology', "Children's eye exams, lazy eye (amblyopia) and school vision screening.", 'baby', 6],
  ['squint', 'Squint & Neuro-ophthalmology', 'Squint (strabismus), double vision and optic nerve disorders.', 'move-horizontal', 7],
  ['oculoplasty', 'Oculoplasty', 'Eyelid, tear duct and eye socket conditions, including droopy eyelids.', 'scissors', 8],
];

// SAMPLE DATA — not real doctors.
const SAMPLE_DOCTORS = [
  ['Dr. Sample Doctor 1', 'general', 'MBBS, MS (Ophthalmology)', 12, ['English', 'Kannada', 'Hindi'], 50000, '+919000000011'],
  ['Dr. Sample Doctor 2', 'cataract', 'MBBS, MS, FICO', 18, ['English', 'Kannada', 'Telugu'], 70000, '+919000000012'],
  ['Dr. Sample Doctor 3', 'retina', 'MBBS, MS, FVRS (Vitreo-Retina)', 10, ['English', 'Hindi', 'Tamil'], 80000, null],
  ['Dr. Sample Doctor 4', 'glaucoma', 'MBBS, DNB (Ophthalmology)', 9, ['English', 'Kannada'], 60000, null],
  ['Dr. Sample Doctor 5', 'cornea', 'MBBS, MS, Fellowship in Cornea', 8, ['English', 'Kannada', 'Hindi'], 60000, null],
  ['Dr. Sample Doctor 6', 'refractive', 'MBBS, MS, Fellowship in Refractive Surgery', 11, ['English', 'Hindi'], 70000, null],
  ['Dr. Sample Doctor 7', 'pediatric', 'MBBS, MS, Fellowship in Paediatric Ophthalmology', 7, ['English', 'Kannada'], 60000, null],
  ['Dr. Sample Doctor 8', 'squint', 'MBBS, DO, DNB', 14, ['English', 'Kannada', 'Malayalam'], 60000, null],
  ['Dr. Sample Doctor 9', 'oculoplasty', 'MBBS, MS, Fellowship in Oculoplasty', 9, ['English', 'Hindi'], 70000, null],
];

export async function seed({ withSamples = true } = {}) {
  await migrate();
  await tx(async (c) => {
    for (const [slug, name, description, icon, sort] of DEPARTMENTS) {
      await c.query(
        `INSERT INTO departments (slug, name, description, icon, sort_order) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order`,
        [slug, name, description, icon, sort]);
    }
    const admin = process.env.SEED_ADMIN_PHONE || '+919000000001';
    await c.query(`INSERT INTO users (phone, name, role) VALUES ($1,'Hospital Admin','admin') ON CONFLICT (phone) DO UPDATE SET role='admin'`, [admin]);
    if (!withSamples) return;
    await c.query(`INSERT INTO users (phone, name, role) VALUES ('+919000000002','Front Desk','receptionist') ON CONFLICT (phone) DO NOTHING`);

    const existing = (await c.query('SELECT count(*)::int AS n FROM doctors')).rows[0].n;
    if (existing > 0) return;
    for (const [name, dept, qual, exp, langs, fee, phone] of SAMPLE_DOCTORS) {
      let userId = null;
      if (phone) {
        userId = (await c.query(`INSERT INTO users (phone, name, role) VALUES ($1,$2,'doctor') ON CONFLICT (phone) DO UPDATE SET role='doctor' RETURNING id`, [phone, name])).rows[0].id;
      }
      const d = (await c.query(
        `INSERT INTO doctors (user_id, department_id, name, qualification, experience_years, languages, bio, fee_paise)
         VALUES ($1, (SELECT id FROM departments WHERE slug = $2), $3, $4, $5, $6, $7, $8) RETURNING id`,
        [userId, dept, name, qual, exp, langs, 'Sample profile. Replace with the doctor\'s real biography from the admin panel.', fee])).rows[0];
      for (let wd = 1; wd <= 6; wd++) {
        await c.query(`INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES ($1,$2,'09:30','13:00',15)`, [d.id, wd]);
        if (wd !== 6) await c.query(`INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES ($1,$2,'14:30','18:30',15)`, [d.id, wd]);
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ withSamples: process.argv.includes('--no-samples') ? false : true })
    .then(() => { console.log('Seed complete'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
