import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Snackbar, IconButton } from "react-native-paper";

const API_URL =
  process.env.API_URL || "http://localhost:3001/auth/reset-password";

const ResetPassword: React.FC = () => {
  const [otp, setOtp] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );
  const router = useRouter();

  const handleResetPassword = async () => {
    // Trim the values to remove any leading or trailing spaces
    const trimmedOtp = otp.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    // Debugging: Log the values to see what is being captured
    console.log("OTP:", trimmedOtp);
    console.log("New Password:", trimmedNewPassword);
    console.log("Confirm Password:", trimmedConfirmPassword);

    if (!trimmedOtp || !trimmedNewPassword || !trimmedConfirmPassword) {
      displaySnackbar("All fields are required.", "error");
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      displaySnackbar("Passwords do not match.", "error");
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: trimmedOtp,
          newPassword: trimmedNewPassword,
          confirmPassword: trimmedConfirmPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        displaySnackbar("Password reset successfully.", "success");
        setTimeout(() => {
          router.push("/auth/login"); // Navigate to login after success
        }, 3000);
      } else {
        displaySnackbar(result.message || "Failed to reset password.", "error");
      }
    } catch (error) {
      displaySnackbar("An error occurred. Please try again.", "error");
    }
  };

  const displaySnackbar = (msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setVisible(true);
    setTimeout(() => setVisible(false), 3000);
  };

  const icon = messageType === "success" ? "check-circle" : "close-circle";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your OTP and new password.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>OTP</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                placeholderTextColor="#999"
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor="#999"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
            >
              <Text style={styles.buttonText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Snackbar
          visible={visible}
          onDismiss={() => setVisible(false)}
          duration={3000}
          style={styles.snackbar}
          icon={() => <IconButton icon={icon} size={20} />}
          theme={{
            colors: { accent: messageType === "success" ? "green" : "red" },
          }}
        >
          {message}
        </Snackbar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 16,
  },
  keyboardAvoid: {
    flex: 1,
  },
  formContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  snackbar: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#333",
  },
});

export default ResetPassword;
