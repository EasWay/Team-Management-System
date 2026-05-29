import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

// ─── Base shimmer block ────────────────────────────────────────────────────────

export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: isDark ? '#334155' : '#cbd5e1',
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Pre-built skeleton layouts ───────────────────────────────────────────────

/** 4-column stat bar (home screen top row) */
export function StatRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1, backgroundColor: 'transparent', gap: 8, alignItems: 'center' }}>
          <Skeleton width={32} height={32} radius={10} />
          <Skeleton width={'70%'} height={14} radius={6} />
          <Skeleton width={'50%'} height={11} radius={5} />
        </View>
      ))}
    </View>
  );
}

/** Horizontal metrics strip */
export function MetricsRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 24 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{ width: 148, padding: 16, borderRadius: 16, gap: 10,
            backgroundColor: 'transparent' }}
        >
          <Skeleton width={'60%'} height={10} radius={5} />
          <Skeleton width={'80%'} height={22} radius={6} />
          <Skeleton width={'50%'} height={10} radius={5} />
        </View>
      ))}
    </View>
  );
}

/** Generic list-item row (tasks / activities) */
export function ListRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingHorizontal: 20, paddingVertical: 14,
          }}
        >
          <Skeleton width={44} height={44} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={'70%'} height={13} radius={6} />
            <Skeleton width={'45%'} height={10} radius={5} />
          </View>
          <Skeleton width={56} height={22} radius={11} />
        </View>
      ))}
    </>
  );
}

/** 2-column project card grid */
export function ProjectGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: '47%', gap: 10, padding: 14, borderRadius: 18,
          backgroundColor: 'transparent' }}>
          <Skeleton width={'100%'} height={80} radius={12} />
          <Skeleton width={'75%'} height={13} radius={6} />
          <Skeleton width={'50%'} height={10} radius={5} />
          <Skeleton width={64} height={20} radius={10} />
        </View>
      ))}
    </View>
  );
}

/** Member avatar strip */
export function MemberStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ alignItems: 'center', gap: 6, width: 52 }}>
          <Skeleton width={48} height={48} radius={24} />
          <Skeleton width={40} height={9} radius={5} />
        </View>
      ))}
    </View>
  );
}

/** Single card skeleton (profile / detail) */
export function CardSkeleton({ height = 80 }: { height?: number }) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
      <Skeleton width={'100%'} height={height} radius={16} />
    </View>
  );
}
