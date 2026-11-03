export const colors = {
  primary: '#0B6E99',
  primaryDark: '#085778',
  primarySoft: '#E6F3F8',
  secondary: '#13A89E',
  secondarySoft: '#E3F6F4',
  accent: '#F4A72C',
  danger: '#D92D20',
  dangerSoft: '#FEE4E2',
  warning: '#B54708',
  warningSoft: '#FEF0C7',
  success: '#067647',
  successSoft: '#DCFAE6',
  text: '#101828',
  textMuted: '#475467',
  textSubtle: '#667085',
  border: '#E4E7EC',
  bg: '#F5F8FA',
  card: '#FFFFFF',
  white: '#FFFFFF',
};

export const space = (n: number) => n * 4;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const type = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  tiny: { fontSize: 11, color: colors.textSubtle, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const shadow = {
  shadowColor: '#0B2A3C',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};
