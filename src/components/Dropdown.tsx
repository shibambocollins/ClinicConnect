import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface DropdownProps {
  label: string;
  value: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  error?: string;
  placeholder?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  error,
  placeholder,
}) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: error ? theme.colors.error : theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: value ? theme.colors.text : theme.colors.textSecondary },
          ]}
        >
          {value || placeholder || `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={[styles.arrow, { color: theme.colors.textSecondary }]}>
          ▼
        </Text>
      </TouchableOpacity>
      {error && (
        <Text style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {label}
            </Text>
            <FlatList
              data={options as string[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    {
                      backgroundColor:
                        value === item ? theme.colors.primary + '15' : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color:
                          value === item ? theme.colors.primary : theme.colors.text,
                        fontWeight: value === item ? '700' : '400',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                  {value === item && (
                    <Text style={{ color: theme.colors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  triggerText: {
    fontSize: 16,
    flex: 1,
  },
  arrow: {
    fontSize: 10,
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 12,
    padding: 16,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
  },
});