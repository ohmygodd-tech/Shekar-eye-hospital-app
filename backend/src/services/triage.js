// Eye symptom checker: suggests urgency and the right department.
// This is a navigation aid, NOT a diagnosis. Red flags always escalate to emergency care.

const RED_FLAGS = [
  { id: 'chemical', words: ['chemical', 'acid', 'alkali', 'lime', 'bleach', 'cement', 'detergent in eye', 'splash'],
    advice: 'Rinse the eye immediately with clean running water for at least 15–20 minutes, then come to the emergency department. Do not rub the eye.' },
  { id: 'sudden_loss', words: ['sudden vision loss', 'suddenly lost vision', 'sudden loss of vision', 'cannot see suddenly', 'went blind', 'sudden blindness', 'vision went black'],
    advice: 'Sudden loss of vision is an emergency. Please come to the hospital immediately.' },
  { id: 'curtain', words: ['curtain', 'shadow over vision', 'veil over', 'shower of floaters', 'many new floaters', 'flashes and floaters'],
    advice: 'A curtain or shadow, or a sudden shower of floaters with flashes, can be a retinal detachment. Please get seen today.' },
  { id: 'injury', words: ['injury', 'hit in the eye', 'struck', 'trauma', 'cracker', 'firecracker', 'cut on eye', 'penetrat', 'something stuck', 'metal piece', 'ball hit'],
    advice: 'Eye injuries need urgent assessment. Do not press on or rub the eye; cover it with a clean shield and come to emergency.' },
  { id: 'severe_pain', words: ['severe eye pain', 'severe pain', 'pain with vomiting', 'eye pain and headache with nausea', 'halos with pain', 'rainbow halos'],
    advice: 'Severe eye pain with headache, nausea or halos can be acute glaucoma. Please come to the hospital immediately.' },
  { id: 'post_op', words: ['after surgery pain', 'after cataract surgery pain', 'post operative pain', 'vision dropped after surgery', 'redness after surgery'],
    advice: 'Increasing pain, redness or falling vision after eye surgery must be checked today. Contact the hospital immediately.' },
  { id: 'double_sudden', words: ['sudden double vision', 'drooping eyelid suddenly', 'face drooping'],
    advice: 'Sudden double vision or drooping can signal a nerve or stroke problem. Seek emergency care now.' },
];

const DEPARTMENTS = [
  { slug: 'cataract', words: ['cloudy', 'blurry', 'blurred', 'blur', 'hazy', 'glare', 'night driving', 'faded colours', 'faded colors', 'cataract', 'dim vision', 'old age vision'] },
  { slug: 'retina', words: ['floaters', 'flashes', 'diabetes', 'diabetic', 'sugar', 'distorted', 'wavy lines', 'straight lines look bent', 'retina', 'black spot', 'central vision'] },
  { slug: 'glaucoma', words: ['glaucoma', 'eye pressure', 'side vision', 'peripheral vision', 'tunnel vision', 'halos', 'family history of glaucoma'] },
  { slug: 'cornea', words: ['red eye', 'redness', 'watering', 'itching', 'itchy', 'discharge', 'sticky', 'pink eye', 'conjunctivitis', 'foreign body', 'gritty', 'burning', 'dry eye', 'dryness', 'light sensitivity', 'ulcer', 'contact lens'] },
  { slug: 'refractive', words: ['spectacles', 'glasses', 'specs', 'power', 'lasik', 'contact lenses', 'remove glasses', 'near vision', 'reading difficulty', 'squinting to see', 'far vision'] },
  { slug: 'pediatric', words: ['child', 'kid', 'baby', 'son', 'daughter', 'school', 'lazy eye', 'infant'] },
  { slug: 'squint', words: ['squint', 'crossed eyes', 'cross eyed', 'eye turning', 'double vision', 'misaligned'] },
  { slug: 'oculoplasty', words: ['eyelid', 'droopy lid', 'drooping eyelid', 'ptosis', 'swelling on lid', 'stye', 'chalazion', 'lump on eyelid', 'tear duct', 'watering since birth', 'bulging eye'] },
];

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
const has = (text, w) => text.includes(` ${w}`) || text.includes(w);

/**
 * @param {{ symptoms: string, age?: number, durationDays?: number, diabetic?: boolean }} input
 */
export function triage({ symptoms, age, durationDays, diabetic }) {
  const text = norm(symptoms);
  const flags = RED_FLAGS.filter((f) => f.words.some((w) => has(text, w)));
  if (flags.length) {
    return {
      urgency: 'emergency',
      title: 'This may be an eye emergency',
      advice: flags.map((f) => f.advice),
      department: 'emergency',
      matched: flags.map((f) => f.id),
      disclaimer: DISCLAIMER,
    };
  }

  const scores = DEPARTMENTS.map((d) => ({ slug: d.slug, score: d.words.filter((w) => has(text, w)).length }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);

  // Context boosts
  if (diabetic) bump(scores, 'retina', 3);
  if (age !== undefined && age < 14) bump(scores, 'pediatric', 3);
  if (age !== undefined && age >= 55 && has(text, 'blur')) bump(scores, 'cataract', 1);
  scores.sort((a, b) => b.score - a.score);

  const top = scores[0]?.slug || 'general';
  const urgent = has(text, 'pain') || has(text, 'light sensitivity') || (has(text, 'red') && has(text, 'blur'));
  const advice = [];
  if (urgent) advice.push('Pain, light sensitivity, or redness with blurred vision should be examined within 24 hours.');
  if (diabetic) advice.push('People with diabetes should have a dilated retina check at least once a year.');
  if (durationDays !== undefined && durationDays > 14 && !urgent) advice.push('Symptoms lasting more than two weeks should be checked by an eye doctor.');
  if (has(text, 'contact lens') && has(text, 'red')) advice.push('Stop wearing contact lenses until you have been examined.');
  if (!advice.length) advice.push('Book a consultation at your convenience. Bring your current glasses and any previous eye reports.');

  return {
    urgency: urgent ? 'soon' : 'routine',
    title: urgent ? 'Please get seen within 24 hours' : 'A routine consultation is suitable',
    advice,
    department: top,
    alternatives: scores.slice(1, 3).map((s) => s.slug),
    disclaimer: DISCLAIMER,
  };
}

function bump(scores, slug, n) {
  const s = scores.find((x) => x.slug === slug);
  if (s) s.score += n; else scores.push({ slug, score: n });
}

export const DISCLAIMER =
  'This tool gives general guidance only and is not a medical diagnosis. If you are worried, call the hospital or visit the emergency department.';
