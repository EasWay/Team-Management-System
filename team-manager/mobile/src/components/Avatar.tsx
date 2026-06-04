import { View, Text, Image } from 'react-native';

const AVATAR_COLORS = ['#5B8DEF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F97316', '#06B6D4', '#EF4444'];

export function getAvatarColor(name?: string | null): string {
  return AVATAR_COLORS[(name ?? '?').charCodeAt(0) % AVATAR_COLORS.length];
}

interface AvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  /** Override the generated accent color */
  color?: string;
}

/**
 * Shared avatar component used everywhere in the app.
 * Shows the real profile picture when `avatarUrl` is set,
 * otherwise shows coloured initials derived from `name`.
 */
export function Avatar({ name, avatarUrl, size = 40, color }: AvatarProps) {
  const accent = color ?? getAvatarColor(name);
  const initials = (name ?? '?')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: accent + '60',
        }}
      >
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent + '28',
        borderWidth: 1.5,
        borderColor: accent + '70',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: accent,
          fontSize: size * 0.36,
          fontWeight: '800',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
