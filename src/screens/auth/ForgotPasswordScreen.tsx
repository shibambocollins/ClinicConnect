// src/screens/auth/ForgotPasswordScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { authApi } from "../../services/api";
import { validateEmail } from "../../utils/validators";

type ForgotPasswordNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSendOtp = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      Alert.alert("Error", emailError);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setIsSuccess(true);
      Alert.alert(
        "OTP Sent",
        "Please check your email for the OTP code to reset your password.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSignIn = () => {
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Reset password</Text>
              </TouchableOpacity>

              <View style={styles.iconWrapper}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.heading}>Forgot your password?</Text>

              <Text style={styles.subtitle}>
                {isSuccess
                  ? "We've sent a verification code to your email. Please check your inbox."
                  : "Enter your registered email and we'll send you OTP"}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSuccess && !isLoading}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (isLoading || isSuccess) && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading || isSuccess}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {isSuccess ? "OTP Sent ✓" : "Send OTP"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.signInRow}>
                <Text style={styles.signInText}>Remembered it? </Text>
                <TouchableOpacity onPress={handleSignIn}>
                  <Text style={styles.signInLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#e8d5b7" },
  flex: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  card: {
    width: 300,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backArrow: { fontSize: 18, color: "#1e2a3a", marginRight: 6 },
  backText: { fontSize: 14, fontWeight: "600", color: "#1e2a3a" },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockIcon: { fontSize: 28 },
  body: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e2a3a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  formGroup: { width: "100%", marginBottom: 20 },
  label: { fontSize: 12, color: "#444444", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: "#1e2a3a",
    width: "100%",
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: "#1e2a3a",
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInText: { fontSize: 12, color: "#666666" },
  signInLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e2a3a",
    textDecorationLine: "underline",
  },
});

export default ForgotPasswordScreen;