import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle, RefreshControl,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, space, type } from '@/lib/theme';
import { initials } from '@/lib/format';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, edges = ['bottom'], refreshing, onRefresh, padded = true, style }: {
  children: React.ReactNode; scroll?: boolean; edges?: Edge[]; refreshing?: boolean; onRefresh?: () => void;
  padded?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const inner = padded ? { padding: space(4), paddingBottom: space(10) } : undefined;
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, size = 'lg' }: {
  title: string; onPress?: () => void; variant?: BtnVariant; loading?: boolean; disabled?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>; size?: 'lg' | 'sm';
}) {
  const v = btn[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={() => { if (off) return; Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        s.btn, size === 'sm' && s.btnSm, { backgroundColor: v.bg, borderColor: v.border },
        pressed && !off && { opacity: 0.85 }, off && { opacity: 0.5 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <View style={s.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={v.fg} style={{ marginRight: 8 }} />}
          <Text style={[s.btnText, size === 'sm' && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const btn: Record<BtnVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft },
  outline: { bg: colors.white, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.white, fg: colors.danger, border: '#FECDCA' },
};

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress'] }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ marginBottom: space(4) }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSubtle}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: colors.primary }, error && { borderColor: colors.danger }, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, props.style]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      style={[s.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.white : colors.textMuted} style={{ marginRight: 5 }} />}
      <Text style={[s.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const t = {
    neutral: [colors.bg, colors.textMuted], success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger], info: [colors.primarySoft, colors.primaryDark],
  }[tone];
  return <View style={[s.badge, { backgroundColor: t[0] }]}><Text style={[s.badgeText, { color: t[1] }]}>{label}</Text></View>;
}

export function Avatar({ name, size = 48, tone = colors.primarySoft }: { name?: string | null; size?: number; tone?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primaryDark, fontWeight: '700', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', marginTop: space(6), marginBottom: space(3) }]}>
      <Text style={type.h3}>{title}</Text>
      {action && <Pressable onPress={onAction} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '600' }}>{action}</Text></Pressable>}
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress, right, danger }: {
  icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.listRow, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
      {icon && (
        <View style={[s.listIcon, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '500' }, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null)}
    </Pressable>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label && <Text style={[type.small, { marginTop: 12 }]}>{label}</Text>}
    </View>
  );
}

export function Empty({ icon = 'document-text-outline', title, message, action, onAction }: {
  icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={[s.center, { paddingVertical: space(12) }]}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      <Text style={[type.h3, { marginTop: space(4), textAlign: 'center' }]}>{title}</Text>
      {message && <Text style={[type.small, { textAlign: 'center', marginTop: 6, maxWidth: 280 }]}>{message}</Text>}
      {action && <Button title={action} onPress={onAction} size="sm" style={{ marginTop: space(5), paddingHorizontal: space(6) }} />}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Empty icon="cloud-offline-outline" title="Couldn't load" message={message} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

export function Notice({ tone = 'info', icon, children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; icon?: IconName; children: React.ReactNode }) {
  const t = { info: [colors.primarySoft, colors.primaryDark, 'information-circle'], warning: [colors.warningSoft, colors.warning, 'alert-circle'],
    danger: [colors.dangerSoft, colors.danger, 'warning'], success: [colors.successSoft, colors.success, 'checkmark-circle'] }[tone] as [string, string, IconName];
  return (
    <View style={[s.notice, { backgroundColor: t[0] }]}>
      <Ionicons name={icon || t[2]} size={18} color={t[1]} style={{ marginRight: 8, marginTop: 1 }} />
      <Text style={{ color: t[1], flex: 1, fontSize: 13.5, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function KeyValue({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
      <Text style={type.small}>{k}</Text>
      <Text style={[type.body, { fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 12 }]}>{v ?? '—'}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: space(4) },
  btnSm: { height: 40, borderRadius: radius.sm },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), ...shadow },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  input: { height: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, color: colors.text, backgroundColor: colors.white },
  error: { color: colors.danger, fontSize: 12.5, marginTop: 5 },
  hint: { color: colors.textSubtle, fontSize: 12.5, marginTop: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, marginRight: 8 },
  chipText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: space(4), backgroundColor: colors.white },
  listIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', padding: 12, borderRadius: radius.md, marginBottom: space(4) },
});
