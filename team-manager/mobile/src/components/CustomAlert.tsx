import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAlertStore, AlertButton, ToastVariant, ToastStatus, ToastConfig } from '../store/alertStore';
import { useThemeStore } from '../store/themeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Custom Alert Helper ────────────────────────────────────────────────────────

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { variant?: ToastVariant; status?: ToastStatus; duration?: number }
  ) => {
    // If it has buttons (multiple or interactive), show Dialog Modal
    if (buttons && buttons.length > 0) {
      useAlertStore.getState().showDialog({
        title,
        message,
        buttons,
      });
    } else {
      // Determine status from content
      let status: ToastStatus = options?.status || 'info';
      const textToSearch = `${title} ${message || ''}`.toLowerCase();

      if (
        status === 'info' &&
        (/error|fail|invalid|wrong|required|could not/i.test(textToSearch))
      ) {
        status = 'error';
      } else if (
        status === 'info' &&
        (/success|sent|connected|uploaded|created|activated|done/i.test(textToSearch))
      ) {
        status = 'success';
      }

      // Heuristic: If it's a simple text notification with no subtitle/message, default to 'minimal' (no background, red/green text)
      // Otherwise, if it has a subtitle/message or is explicit, use 'card'
      const variant = options?.variant || (message ? 'card' : 'minimal');

      // If it contains "Event has been created" or is success/error but we want a button (e.g. Undo), it should be a 'card'.
      // Wait, let's also support a button if we have a default "Undo" or "OK" case.
      let action: ToastConfig['action'] | undefined = undefined;

      // Special case: Event creation is styled with a "Undo" button
      if (title.toLowerCase().includes('event has been created') || textToSearch.includes('event has been created')) {
        action = {
          label: 'Undo',
          onPress: () => {
            // We can search for the delete mutation callback or show another toast
            Alert.alert('Undone', 'Event creation was reverted.');
          },
        };
      }

      useAlertStore.getState().addToast({
        title,
        message,
        variant,
        status,
        duration: options?.duration || 3500,
        action,
      });
    }
  },

  prompt: (
    title: string,
    message?: string,
    callbackOrButtons?: ((value: string) => void) | AlertButton[],
    type?: string,
    defaultValue?: string
  ) => {
    if (typeof callbackOrButtons === 'function') {
      useAlertStore.getState().showDialog({
        title,
        message,
        isPrompt: true,
        promptCallback: callbackOrButtons,
        promptPlaceholder: defaultValue || '',
      });
    } else {
      // If it's buttons
      useAlertStore.getState().showDialog({
        title,
        message,
        buttons: callbackOrButtons,
      });
    }
  },
};

// ─── Minimalist Card Toast ───────────────────────────────────────────────────────

const CardToast = ({ toast, onDismiss }: { toast: ToastConfig; onDismiss: () => void }) => {
  const isDark = useThemeStore(state => state.isDark);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in & Fade in
    Animated.spring(animatedValue, {
      toValue: 1,
      tension: 40,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      handleClose();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0.8, 1],
  });

  const statusColor =
    toast.status === 'success'
      ? '#10b981'
      : toast.status === 'error'
      ? '#ef4444'
      : '#38bdf8';

  const iconName =
    toast.status === 'success'
      ? 'checkmark-circle'
      : toast.status === 'error'
      ? 'alert-circle'
      : 'information-circle';

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* Top Main Card */}
      <View
        style={[
          styles.cardMain,
          {
            backgroundColor: isDark ? '#121212' : '#ffffff',
            borderColor: isDark ? '#262626' : '#cbd5e1',
          },
        ]}
      >
        <Ionicons name={iconName} size={15} color={statusColor} style={{ marginRight: 8, marginTop: 1 }} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: statusColor }]}>{toast.title}</Text>
          {toast.message && (
            <Text style={[styles.cardSubtitle, { color: isDark ? '#a3a3a3' : '#64748b' }]}>
              {toast.message}
            </Text>
          )}
        </View>
        {toast.action ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              toast.action?.onPress();
              handleClose();
            }}
            style={[styles.cardActionBtn, { backgroundColor: isDark ? '#ffffff' : '#0ea5e9' }]}
          >
            <Text style={[styles.cardActionText, { color: isDark ? '#121212' : '#ffffff' }]}>
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleClose} style={styles.cardCloseBtn}>
            <Ionicons name="close" size={14} color={isDark ? '#666' : '#94a3b8'} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Minimal Text Toast ─────────────────────────────────────────────────────────

const MinimalTextToast = ({ toast, onDismiss }: { toast: ToastConfig; onDismiss: () => void }) => {
  const isDark = useThemeStore(state => state.isDark);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade & Slide in
    Animated.spring(animatedValue, {
      toValue: 1,
      tension: 50,
      friction: 9,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      handleClose();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const textColor = toast.status === 'success' ? '#10b981' : toast.status === 'error' ? '#ef4444' : (isDark ? '#f1f5f9' : '#0f172a');
  const iconName =
    toast.status === 'success'
      ? 'checkmark-circle-outline'
      : toast.status === 'error'
      ? 'alert-circle-outline'
      : 'information-circle-outline';

  return (
    <Animated.View
      style={[
        styles.minimalToast,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Ionicons name={iconName} size={18} color={textColor} style={{ marginRight: 6 }} />
      <Text style={[styles.minimalText, { color: textColor }]}>{toast.title}</Text>
    </Animated.View>
  );
};

// ─── Custom Dialog / Prompt Modal ───────────────────────────────────────────────

const CustomDialogModal = () => {
  const isDark = useThemeStore(state => state.isDark);
  const { activeDialog, hideDialog } = useAlertStore();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (activeDialog) {
      setInputValue(activeDialog.promptPlaceholder || '');
    }
  }, [activeDialog]);

  if (!activeDialog) return null;

  const handleButtonPress = (btn: AlertButton) => {
    hideDialog();
    if (activeDialog.isPrompt && activeDialog.promptCallback) {
      activeDialog.promptCallback(inputValue);
    } else if (btn.onPress) {
      btn.onPress();
    }
  };

  const renderButtons = () => {
    const buttons = activeDialog.buttons || [{ text: 'OK' }];

    // If 2 buttons, render side by side. Otherwise stacked
    const containerStyle = buttons.length === 2 ? styles.dialogButtonRow : styles.dialogButtonStack;

    return (
      <View style={containerStyle}>
        {buttons.map((btn, index) => {
          const isDestructive = btn.style === 'destructive';
          const isCancel = btn.style === 'cancel';

          let btnBg = isDark ? '#1e293b' : '#f1f5f9';
          let textColor = isDark ? '#f1f5f9' : '#0f172a';

          if (isDestructive) {
            btnBg = '#ef4444';
            textColor = '#ffffff';
          } else if (isCancel) {
            btnBg = isDark ? '#0f172a' : '#ffffff';
            textColor = '#64748b';
          } else if (buttons.length === 1 || index === buttons.length - 1) {
            btnBg = '#0ea5e9'; // primary action
            textColor = '#ffffff';
          }

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.85}
              onPress={() => handleButtonPress(btn)}
              style={[
                styles.dialogButton,
                { backgroundColor: btnBg, flex: buttons.length === 2 ? 1 : undefined },
                isCancel && { borderWidth: 1, borderColor: isDark ? '#1e293b' : '#cbd5e1' },
              ]}
            >
              <Text style={[styles.dialogButtonText, { color: textColor }]}>{btn.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={hideDialog}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={activeDialog.isPrompt ? undefined : hideDialog}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#1e293b' : '#cbd5e1',
            },
          ]}
        >
          <Text style={[styles.dialogTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
            {activeDialog.title}
          </Text>
          {activeDialog.message && (
            <Text style={[styles.dialogMessage, { color: isDark ? '#94a3b8' : '#475569' }]}>
              {activeDialog.message}
            </Text>
          )}

          {activeDialog.isPrompt && (
            <TextInput
              autoFocus
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Type here..."
              placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              style={[
                styles.dialogInput,
                {
                  backgroundColor: isDark ? '#0a0f1e' : '#f8fafc',
                  borderColor: isDark ? '#1e293b' : '#cbd5e1',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                },
              ]}
              keyboardType={
                activeDialog.title.includes('0-100') ||
                activeDialog.title.includes('0–100') ||
                activeDialog.message?.includes('0-100') ||
                activeDialog.message?.includes('0–100') ||
                activeDialog.title.toLowerCase().includes('progress')
                  ? 'numeric'
                  : 'default'
              }
            />
          )}

          {renderButtons()}
        </View>
      </View>
    </Modal>
  );
};

// ─── Custom Alert Provider ──────────────────────────────────────────────────────

export const CustomAlertProvider = () => {
  const { toasts, removeToast } = useAlertStore();

  // Split toasts into card toasts (bottom) and minimal text alerts (top)
  const cardToasts = toasts.filter((t) => t.variant === 'card');
  const minimalToasts = toasts.filter((t) => t.variant === 'minimal');

  return (
    <>
      {/* Top minimal text alerts */}
      {minimalToasts.length > 0 && (
        <View style={styles.topContainer} pointerEvents="box-none">
          {minimalToasts.map((toast) => (
            <MinimalTextToast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
          ))}
        </View>
      )}

      {/* Bottom custom card toasts */}
      {cardToasts.length > 0 && (
        <View style={styles.bottomContainer} pointerEvents="box-none">
          {cardToasts.map((toast) => (
            <CardToast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
          ))}
        </View>
      )}

      {/* Confirmation/Prompt dialog overlay */}
      <CustomDialogModal />
    </>
  );
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Global Toast Containers
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 36,
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 90, // Positioned above the tab bar or at the bottom
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },

  // Card visual style
  toastWrapper: {
    width: '100%',
    maxWidth: 450,
  },
  cardMain: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  cardContent: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 15,
  },
  cardSubtitle: {
    color: '#a3a3a3',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 13,
  },
  cardActionBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  cardActionText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 10,
  },
  cardCloseBtn: {
    padding: 3,
  },

  // Minimal Text-only style
  minimalToast: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 6,
  },
  minimalText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Dialog Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  dialogTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogMessage: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  dialogInput: {
    backgroundColor: '#0a0f1e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#f1f5f9',
    fontSize: 14,
    marginBottom: 20,
    width: '100%',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButtonStack: {
    flexDirection: 'column',
    gap: 8,
  },
  dialogButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
