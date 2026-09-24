/**
 * Bottom sheet in pure React Native, standing in for expo-router's
 * `presentation: "formSheet"` / `"modal"` routes (see AGENTS.md — the iOS
 * app's sheet tables map onto this component). Content-sized height with a
 * screen-height cap, slide-up/slide-down animation, backdrop tap and hardware
 * back to close.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, Easing, Pressable, StyleSheet, View } from "react-native";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useSafeAreaInsets } from "@/lib/safe-area";
import { useThemeColors } from "@/lib/use-theme-colors";

const ANIM_MS = 260;

export function BottomSheet({
  visible,
  onClose,
  children,
  /** Fraction of screen height the sheet may occupy. */
  maxHeightRatio = 0.92,
  avoidKeyboard = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
  avoidKeyboard?: boolean;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [mounted, setMounted] = useState(visible);
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: ANIM_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (!visibleRef.current) setMounted(false);
      });
    }
    // `mounted` is intentionally not a dependency: visible drives both paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // While open, hardware back closes the sheet instead of popping the stack
  // (last-registered BackHandler wins in RN).
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visibleRef.current) {
        onClose();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  if (!mounted) return null;

  const maxHeight = Math.round(
    Dimensions.get("window").height * maxHeightRatio - insets.top,
  );
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [contentHeight + insets.bottom || 400, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View style={[styles.backdropWrap, { opacity: progress }]}>
        <Pressable
          accessibilityLabel="Close sheet"
          style={styles.backdrop}
          onPress={onClose}
        />
      </Animated.View>
      <View
        style={[
          styles.avoidWrap,
          avoidKeyboard ? { paddingBottom: keyboardHeight } : null,
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.card,
              maxHeight,
              marginBottom: insets.bottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.mutedForeground }]} />
          <View
            style={styles.content}
            onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { ...StyleSheet.absoluteFillObject },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  avoidWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.4,
    marginTop: 6,
  },
  content: { paddingBottom: 8 },
});
