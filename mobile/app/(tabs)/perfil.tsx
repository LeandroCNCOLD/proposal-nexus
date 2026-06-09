import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'

export default function PerfilScreen() {
  const { user, signOut, userName } = useAuth()

  function handleLogout() {
    Alert.alert('Sair?', 'Você será desconectado do app.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ])
  }

  const inicial = userName.charAt(0).toUpperCase()

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>👤 Perfil</Text>
      </View>

      <View style={s.content}>
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{inicial}</Text>
          </View>
          <Text style={s.nome}>{userName}</Text>
          <Text style={s.email}>{user?.email ?? ''}</Text>
        </View>

        <View style={s.card}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email ?? '—'}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ID do usuário</Text>
            <Text style={s.infoValue} numberOfLines={1}>
              {user?.id?.slice(0, 8) ?? '—'}…
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Último login</Text>
            <Text style={s.infoValue}>
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')
                : '—'}
            </Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Versão do app</Text>
            <Text style={s.infoValue}>1.0.0</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Ambiente</Text>
            <Text style={s.infoValue}>Produção</Text>
          </View>
        </View>

        <TouchableOpacity style={s.btnLogout} onPress={handleLogout}>
          <Text style={s.btnLogoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0F2D5E', padding: 20, paddingTop: 56 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  content: { padding: 20, gap: 16 },
  avatarWrap: { alignItems: 'center', paddingVertical: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0F2D5E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  nome: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  email: { fontSize: 14, color: '#64748B', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#0F172A', fontWeight: '600', maxWidth: '60%' },
  btnLogout: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnLogoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
