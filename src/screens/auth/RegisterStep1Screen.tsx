import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Dropdown } from '../../components/Dropdown';
import { validatePersonalInfo, PASSWORD_RULES } from '../../utils/registrationValidation';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

const ETHNICITY_OPTIONS = [
  'African',
  'Coloured',
  'Indian/Asian',
  'White',
  'Other',
] as const;

const OptionChip = ({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary + '15' : colors.surface,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text
      style={[
        styles.chipText,
        { color: selected ? colors.primary : colors.textSecondary },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const PatientRegistration = ({ navigation }: any) => {
  const { theme } = useTheme();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',
    idNumber: '',
    gender: '',
    ethnicity: '',
    sms: false,
    notifyEmail: false,
    inApp: false,
  });
  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const newErrors = validatePersonalInfo(form);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    navigation.navigate('RegisterStep2', { ...form });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backIconText, { color: theme.colors.primary }]}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Create account
          </Text>
          <Text style={[styles.stepIndicator, { color: theme.colors.textSecondary }]}>
            Step 1 of 2
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.colors.primary, width: '50%' },
            ]}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Personal Information
        </Text>

        <View style={[styles.borderedBox, { borderColor: theme.colors.border }]}>
          <Input
            label="First Name"
            value={form.firstName}
            onChangeText={(v) => updateField('firstName', v)}
            autoCapitalize="words"
            error={errors.firstName}
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChangeText={(v) => updateField('lastName', v)}
            autoCapitalize="words"
            error={errors.lastName}
          />
          <Input
            label="ID Number"
            value={form.idNumber}
            onChangeText={(v) => updateField('idNumber', v.replace(/\D/g, ''))}
            keyboardType="numeric"
            maxLength={13}
            placeholder="13-digit SA ID number"
            error={errors.idNumber}
          />
          <Input
            label="Email"
            value={form.email}
            onChangeText={(v) => updateField('email', v.trim())}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            error={errors.email}
          />
          <Input
            label="Password"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            isPassword
            autoCapitalize="none"
            error={errors.password}
          />
          {!errors.password && (
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.textSecondary,
                marginTop: -8,
                marginBottom: 8,
              }}
            >
              {PASSWORD_RULES}
            </Text>
          )}
          <Input
            label="Confirm Password"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            isPassword
            autoCapitalize="none"
            error={errors.confirmPassword}
          />
          <Input
            label="Contact Number"
            value={form.contactNumber}
            onChangeText={(v) =>
              updateField('contactNumber', v.replace(/\D/g, '').slice(0, 10))
            }
            keyboardType="number-pad"
            maxLength={10}
            placeholder="0821234567"
            error={errors.contactNumber}
          />

          <Dropdown
            label="Gender"
            value={form.gender}
            options={GENDER_OPTIONS}
            onSelect={(v) => updateField('gender', v)}
            error={errors.gender}
          />

          <Dropdown
            label="Ethnicity"
            value={form.ethnicity}
            options={ETHNICITY_OPTIONS}
            onSelect={(v) => updateField('ethnicity', v)}
            error={errors.ethnicity}
          />

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Notification Preferences
          </Text>
          <View style={styles.optionsRow}>
            <OptionChip
              label="SMS"
              selected={form.sms}
              onPress={() => updateField('sms', !form.sms)}
              colors={theme.colors}
            />
            <OptionChip
              label="Email"
              selected={form.notifyEmail}
              onPress={() => updateField('notifyEmail', !form.notifyEmail)}
              colors={theme.colors}
            />
            <OptionChip
              label="In-App"
              selected={form.inApp}
              onPress={() => updateField('inApp', !form.inApp)}
              colors={theme.colors}
            />
          </View>
          {errors.notifications && (
            <Text style={[styles.fieldError, { color: theme.colors.error }]}>
              {errors.notifications}
            </Text>
          )}
        </View>

        <Button
          title="Next"
          onPress={handleNext}
          style={styles.nextButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default PatientRegistration;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  backIcon: { marginBottom: 8, alignSelf: 'flex-start' },
  backIconText: { fontSize: 16, fontWeight: '600' },
  header: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  stepIndicator: { fontSize: 14, fontWeight: '500' },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  borderedBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '500' },
  fieldError: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  nextButton: { marginTop: 8 },
});