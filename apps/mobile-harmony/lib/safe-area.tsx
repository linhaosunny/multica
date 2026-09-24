/**
 * Safe-area insets for the HarmonyOS client — API-compatible subset of
 * react-native-safe-area-context. The tpl package's JS component layer
 * (SafeAreaProvider/SafeAreaView native components) is not wired on this
 * matrix, but its TurboModule IS (CPP proxy hand-written in
 * harmony/entry/src/main/cpp/PackageProvider.cpp): getConstants() returns
 * the system avoid-area metrics, getSafeAreaInsets() resolves them
 * asynchronously. This module feeds both into a plain React context.
 *
 * Consumers: `useSafeAreaInsets()` and `<SafeAreaView edges={[...]}/>`.
 * Fallback metrics apply only while the native module is absent (old HAP).
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { TurboModuleRegistry, View, type StyleProp, type ViewStyle } from "react-native";

type Insets = { top: number; right: number; bottom: number; left: number };
type WindowMetrics = {
  insets: Insets;
  frame: { x: number; y: number; width: number; height: number };
};

type SafeAreaModuleSpec = {
  getConstants(): { initialWindowMetrics?: WindowMetrics };
  getSafeAreaInsets(): Promise<WindowMetrics>;
};

const safeAreaModule =
  TurboModuleRegistry.get<SafeAreaModuleSpec>("RNCSafeAreaContext");

const FALLBACK_METRICS: WindowMetrics = {
  insets: { top: 44, right: 0, bottom: 24, left: 0 },
  frame: { x: 0, y: 0, width: 0, height: 0 },
};

const SafeAreaContext = createContext<WindowMetrics>(
  safeAreaModule?.getConstants?.().initialWindowMetrics ?? FALLBACK_METRICS,
);

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  // getConstants may race the window setup on the ArkTS side (the module
  // resolves the window asynchronously in its constructor) and return zero
  // insets; refresh once the promise-based read lands.
  const [metrics, setMetrics] = useState<WindowMetrics>(() =>
    safeAreaModule?.getConstants?.().initialWindowMetrics ?? FALLBACK_METRICS,
  );

  useEffect(() => {
    let cancelled = false;
    safeAreaModule
      ?.getSafeAreaInsets?.()
      .then((m) => {
        if (!cancelled && m?.insets) setMetrics(m);
      })
      .catch(() => {
        // Keep whatever getConstants produced.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SafeAreaContext.Provider value={metrics}>{children}</SafeAreaContext.Provider>;
}

export function useSafeAreaInsets(): Insets {
  return useContext(SafeAreaContext).insets;
}

export type SafeAreaEdge = "top" | "bottom" | "left" | "right";

export function SafeAreaView({
  edges = ["top", "bottom", "left", "right"],
  style,
  children,
}: {
  edges?: SafeAreaEdge[];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };
  return <View style={[padding, style]}>{children}</View>;
}
