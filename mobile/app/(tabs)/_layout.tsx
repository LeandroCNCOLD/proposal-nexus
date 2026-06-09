import { Tabs } from 'expo-router'
import { Home, Briefcase, Phone, Calendar, User, Database } from 'lucide-react-native'
import type { ColorValue } from 'react-native'

type IconProps = { color: ColorValue; size: number }

function icon(Icon: any) {
  return ({ color, size }: IconProps) => <Icon color={color} size={size} />
}

function phoneIcon({ color, size }: IconProps) {
  const PhoneAny = Phone as any
  return <PhoneAny color={color} fill={color} size={size + 4} />
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F2D5E',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'War Room', tabBarIcon: icon(Home) }}
      />
      <Tabs.Screen
        name="carteira"
        options={{ title: 'Carteira', tabBarIcon: icon(Briefcase) }}
      />
      <Tabs.Screen
        name="ligar"
        options={{ title: 'Ligar', tabBarIcon: phoneIcon }}
      />
      <Tabs.Screen
        name="banco"
        options={{ title: 'Banco', tabBarIcon: icon(Database) }}
      />
      <Tabs.Screen
        name="agenda"
        options={{ title: 'Agenda', tabBarIcon: icon(Calendar) }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: icon(User) }}
      />
    </Tabs>
  )
}
