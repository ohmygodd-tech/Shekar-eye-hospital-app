import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { colors, radius, space } from '@/lib/theme';

type Action = { type: 'navigate'; to: string; department?: string } | { type: 'call'; phone: string } | { type: 'open_url'; url: string };
type Msg = { id: string; role: 'user' | 'assistant'; content: string; action?: Action };

const SUGGESTIONS = ['How do I book?', 'OPD timings', 'Where are you located?', 'Is cashless insurance available?', 'What should I bring?', 'Can I drive after an eye exam?'];

export default function Assistant() {
  const { user } = useSession();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 'hi', role: 'assistant', content: "Hello! I'm the Shekar Eye Hospital help assistant. Ask me about appointments, timings, reports or common eye-care questions." }]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Msg>>(null);

  async function send(m = text) {
    const message = m.trim();
    if (!message || sending) return;
    setText('');
    const history = msgs.filter((x) => x.id !== 'hi').map(({ role, content }) => ({ role, content }));
    setMsgs((x) => [...x, { id: `${Date.now()}`, role: 'user', content: message }]);
    setSending(true);
    try {
      const r = await api<{ reply: string; action?: Action }>('/ai/chat', { body: { message, history }, auth: false });
      setMsgs((x) => [...x, { id: `${Date.now()}a`, role: 'assistant', content: r.reply, action: r.action }]);
    } catch {
      setMsgs((x) => [...x, { id: `${Date.now()}e`, role: 'assistant', content: 'Sorry, I could not connect. Please check your internet or call the hospital.' }]);
    } finally {
      setSending(false);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function runAction(a: Action) {
    if (a.type === 'call') Linking.openURL(`tel:${a.phone.replace(/[^\d+]/g, '')}`);
    else if (a.type === 'open_url') Linking.openURL(a.url);
    else if (!user) router.back();
    else if (a.to === 'book') a.department && a.department !== 'general'
      ? router.push({ pathname: '/doctors', params: { department: a.department } }) : router.push('/(tabs)/book');
    else if (a.to === 'records') router.push('/(tabs)/records');
    else if (a.to === 'appointments') router.push('/(tabs)/appointments');
  }
  const actionLabel = (a: Action) => (a.type === 'call' ? 'Call now' : a.type === 'open_url' ? 'Open map' : a.to === 'book' ? 'Book appointment' : a.to === 'records' ? 'Open records' : 'Open appointments');

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space(4) }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[st.bubble, item.role === 'user' ? st.user : st.bot]}>
              <Text style={{ color: item.role === 'user' ? colors.white : colors.text, fontSize: 15, lineHeight: 21 }}>{item.content}</Text>
              {item.action && (
                <Pressable onPress={() => runAction(item.action!)} style={st.action}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{actionLabel(item.action)} →</Text>
                </Pressable>
              )}
            </View>
          )}
          ListFooterComponent={msgs.length === 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {SUGGESTIONS.map((q) => <Pressable key={q} onPress={() => send(q)} style={st.sugg}><Text style={{ color: colors.primary, fontSize: 13.5 }}>{q}</Text></Pressable>)}
            </View>
          ) : sending ? <Text style={{ color: colors.textSubtle, marginLeft: 4 }}>Typing…</Text> : undefined}
        />
        <View style={st.inputBar}>
          <TextInput value={text} onChangeText={setText} placeholder="Type your question" placeholderTextColor={colors.textSubtle} style={st.input} onSubmitEditing={() => send()} returnKeyType="send" multiline maxLength={1000} />
          <Pressable onPress={() => send()} disabled={!text.trim() || sending} style={[st.send, (!text.trim() || sending) && { opacity: 0.4 }]} accessibilityLabel="Send">
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 11, color: colors.textSubtle, textAlign: 'center', paddingBottom: 6 }}>Automated assistant · not a substitute for a doctor's advice</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: 12, borderRadius: radius.lg, marginBottom: 10 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  action: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sugg: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.white },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  input: { flex: 1, minHeight: 42, maxHeight: 110, backgroundColor: colors.bg, borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
