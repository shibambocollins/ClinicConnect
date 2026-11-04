// src/screens/auth/RegisterStep2Screen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Dropdown } from '../../components/Dropdown';
import { validateAddressInfo } from '../../utils/registrationValidation';

const PROVINCE_OPTIONS = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

const PatientRegistration = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { register } = useAuth();
  const personalInfo = route.params || {};
  const [registrationComplete, setRegistrationComplete] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    streetNumber: '',
    streetName: '',
    city: '',
    postalCode: '',
    province: '',
    nextOfKinName: '',
    nextOfKinRelationship: '',
    nextOfKinContactNumber: '',
  });

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const newErrors = validateAddressInfo(form);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validate()) return;
    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await register(personalInfo.email, personalInfo.password, {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        // Already strict 10-digit SA local format; pass through as-is.
        contactNumber: personalInfo.contactNumber.trim(),
        idNumber: personalInfo.idNumber,
        gender: personalInfo.gender,
        ethnicity: personalInfo.ethnicity,
        sms: personalInfo.sms,
        notifyEmail: personalInfo.notifyEmail,
        inApp: personalInfo.inApp,
        streetNumber: form.streetNumber,
        streetName: form.streetName,
        city: form.city,
        postalCode: form.postalCode,
        province: form.province,
        nextOfKinName: form.nextOfKinName,
        nextOfKinRelationship: form.nextOfKinRelationship,
        // Strict 10-digit SA local format; pass through as-is.
        nextOfKinContactNumber: form.nextOfKinContactNumber.trim(),
      });

      setIsSubmitting(false);

      if (result.needsVerification) {
        navigation.navigate('VerifyEmail', { email: personalInfo.email });
      } else {
        setRegistrationComplete(true);
      }
    } catch (err: any) {
      const message = err.message || '';
      if (
        message.toLowerCase().includes('already') ||
        message.toLowerCase().includes('exists') ||
        message.toLowerCase().includes('duplicate')
      ) {
        setErrors({
          general: 'An account with this email already exists. Please sign in instead.',
        });
      } else {
        setErrors({ general: message || 'Registration failed. Please try again.' });
      }
      setIsSubmitting(false);
    }
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
        {registrationComplete ? (
          <View style={styles.successContainer}>
            <Text style={[styles.successTitle, { color: theme.colors.text }]}>
              Registration Successful!
            </Text>
            <View
              style={[styles.iconCircle, { borderColor: theme.colors.success || '#22C55E' }]}
            >
              <Ionicons
                name="checkmark-sharp"
                size={48}
                color={theme.colors.success || '#22C55E'}
              />
            </View>
            <Text
              style={[styles.successSubtitle, { color: theme.colors.textSecondary }]}
            >
              Your account has been created successfully.{'\n'}
              You will be redirected to the home screen.
            </Text>
            <Text
              style={[
                styles.successSubtitle,
                { color: theme.colors.textSecondary, marginTop: 8 },
              ]}
            >
              Opening your home screen…
            </Text>
          </View>
        ) : (
          <>
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
              <Text
                style={[styles.stepIndicator, { color: theme.colors.textSecondary }]}
              >
                Step 2 of 2
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.colors.primary, width: '100%' },
                ]}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Address
            </Text>

            <View style={[styles.borderedBox, { borderColor: theme.colors.border }]}>
              <Input
                label="Street Number"
                value={form.streetNumber}
                onChangeText={(v) => updateField('streetNumber', v)}
                error={errors.streetNumber}
              />
              <Input
                label="Street Name"
                value={form.streetName}
                onChangeText={(v) => updateField('streetName', v)}
                autoCapitalize="words"
                error={errors.streetName}
              />
              <Input
                label="City"
                value={form.city}
                onChangeText={(v) => updateField('city', v)}
                autoCapitalize="words"
                error={errors.city}
              />
              <Input
                label="Postal Code"
                value={form.postalCode}
                onChangeText={(v) => updateField('postalCode', v.replace(/\D/g, ''))}
                keyboardType="numeric"
                maxLength={4}
                error={errors.postalCode}
              />
              <Dropdown
                label="Province"
                value={form.province}
                options={PROVINCE_OPTIONS}
                onSelect={(v) => updateField('province', v)}
                error={errors.province}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Next of Kin
            </Text>

            <View style={[styles.borderedBox, { borderColor: theme.colors.border }]}>
              <Input
                label="Full Name"
                value={form.nextOfKinName}
                onChangeText={(v) => updateField('nextOfKinName', v)}
                autoCapitalize="words"
                error={errors.nextOfKinName}
              />
              <Input
                label="Relationship"
                value={form.nextOfKinRelationship}
                onChangeText={(v) => updateField('nextOfKinRelationship', v)}
                autoCapitalize="words"
                error={errors.nextOfKinRelationship}
              />
              <Input
                label="Contact Number"
                value={form.nextOfKinContactNumber}
                onChangeText={(v) =>
                  updateField('nextOfKinContactNumber', v.replace(/\D/g, '').slice(0, 10))
                }
                keyboardType="number-pad"
                maxLength={10}
                placeholder="0821234567"
                error={errors.nextOfKinContactNumber}
              />
            </View>

            {errors.general && (
              <Text style={[styles.generalError, { color: theme.colors.error }]}>
                {errors.general}
              </Text>
            )}

            <Button
              title="Create Account"
              onPress={handleCreateAccount}
              loading={isSubmitting}
              style={styles.nextButton}
            />
          </>
        )}
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
  nextButton: { marginTop: 8 },
  generalError: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 110,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
});