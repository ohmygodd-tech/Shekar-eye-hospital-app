# Publishing to Google Play and the Apple App Store

The app is built in the cloud with **EAS Build** (no Mac or Android Studio needed) and submitted with **EAS Submit**.

## 0. Accounts — must be in the hospital's (organisation's) name

Both stores expect healthcare apps to be published by the organisation that provides the care, not an individual:

| Store | Requirement | Cost |
|---|---|---|
| **Google Play** | Google requires health apps to be published from an **Organization** developer account (needs a **D-U-N-S number**, free, can take up to ~30 days). Organisation accounts also skip the "12 testers for 14 days" closed-test rule that applies to new personal accounts. | US$25 one-time |
| **Apple App Store** | Guideline 5.1.1(ix): apps handling health data in regulated fields should be submitted by the legal entity providing the service. Enrol as an **Organization** (also needs D-U-N-S). | US$99 / year |
| **Expo (EAS)** | Free tier is fine to start. Create an organisation account for the hospital. | Free / paid tiers |

Start the D-U-N-S request first — it's the longest lead time.

## 1. One-time setup

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init          # writes the real projectId into app.json → extra.eas.projectId
```

Then edit `mobile/app.json`:
- `ios.bundleIdentifier` / `android.package`: keep `com.shekareyehospital.app` or use the hospital's domain reversed. **This can never change after publishing.**
- Replace images in `mobile/assets/` with the hospital logo: `icon.png` 1024×1024 (no transparency for iOS), `android-icon-foreground.png`, `splash-icon.png`
- In `eas.json`, set `EXPO_PUBLIC_API_URL` for `production` to `https://api.<your-domain>/api`

## 2. Build

```bash
npx eas-cli@latest build --platform android --profile production   # .aab for Play
npx eas-cli@latest build --platform ios --profile production       # .ipa for App Store
```
EAS creates and stores signing keys and push-notification credentials (FCM/APNs) for you — answer "yes" when asked.

For testing on phones first: `--profile preview` (Android APK you can install directly) or TestFlight on iOS.

## 3. Reviewer demo account (both stores require a working login)

Set in the server `.env`:
```
REVIEWER_PHONE=+919999999999
REVIEWER_OTP=246810
```
This one number logs in with a fixed OTP and no SMS. Give reviewers: *Phone 9999999999, OTP 246810*. Pre-create a sample record and appointment for it from the staff portal so reviewers can see every screen.

## 4. Google Play Console

1. Create app → name "Shekar Eye Hospital", category **Medical**, free.
2. **App content** (Policy → App content):
   - **Privacy policy URL**: host `docs/PRIVACY_POLICY.md` (after legal review) on the hospital website.
   - **Health apps declaration**: required for every app. Tick the medical/health categories that apply, e.g. appointment booking/healthcare services and medical records/health information management.
   - **Data safety**: declare the data in the table below. Encrypted in transit: Yes. Users can request deletion: Yes (in app).
   - **Account deletion URL**: Google also requires a web link where users can request deletion. Use a page on the hospital website, or an email address/form handled by the front desk.
   - Target audience: 18+ (parents manage children's profiles). Ads: No.
   - Government app: No. Financial features: No.
3. **Store listing**: short and full description, 2+ phone screenshots (1080×1920 recommended), feature graphic 1024×500, app icon 512×512.
4. Release: upload the `.aab` to **Internal testing** → test → **Production**.

## 5. App Store Connect

1. Create app → bundle ID from app.json, primary category **Medical**.
2. **App Privacy** labels: declare the same data as below, "Linked to the user", **not** used for tracking.
3. **Age rating** questionnaire: medical/treatment information "Infrequent/Mild" → typically 17+ or 12+ per Apple's form.
4. Screenshots: 6.9" iPhone (1320×2868) required; iPad screenshots if `supportsTablet` stays `true` (set it to `false` in app.json to skip iPad).
5. Review notes: give the demo login, explain that payments are for **in-person medical consultations** (guideline 3.1.3(d) / physical services, so in-app purchase does not apply), and that the symptom checker is guidance only with clear disclaimers.
6. Submit with `npx eas-cli@latest submit --platform ios`.

## Data to declare (both stores)

| Data | Collected | Purpose | Shared with third parties |
|---|---|---|---|
| Phone number | Yes | Account login (OTP), appointment SMS | SMS provider (processor) |
| Name, date of birth, gender | Yes | Patient identification | No |
| Health info (medical history, allergies, eye test results, prescriptions, reports, symptoms typed into checker) | Yes | Providing medical care | No |
| Purchase history (consultation payments) | Yes | Payments, receipts | Razorpay (processor) |
| Email (optional) | Yes | Communication | No |
| Device push token | Yes | Notifications | Expo/Google/Apple push services (processors) |
| Location, contacts, photos, advertising ID | **No** | — | — |

If you enable `ANTHROPIC_API_KEY` for AI assistant answers, the typed question is sent to Anthropic's API to generate a reply. Disclose this as a processor in the privacy policy.

## Things reviewers check in health apps (already handled)

- ✅ Medical disclaimer on the symptom checker and assistant ("not a diagnosis; consult a doctor"), which Google and Apple both require
- ✅ In-app account deletion (Profile → Delete account), Apple 5.1.1(v)
- ✅ Consent screen before storing health data
- ✅ No unnecessary permissions (camera, location, contacts and storage are not requested)
- ✅ Emergency guidance points to calling the hospital
- ⬜ Real hospital name, address and phone numbers everywhere (see GO_LIVE_CHECKLIST.md)
- ⬜ Privacy policy live at a public URL and linked in the app (`mobile/src/app/privacy.tsx` → `PRIVACY_URL`)

## Over-the-air updates

JS-only fixes can ship without a store review: `npx eas-cli@latest update --channel production`. Changes to native modules, permissions or app.json need a new build and a new store submission.
