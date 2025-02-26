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
  process.env.API_URL || "http://192.168.1.70:3001/auth/forgot-password";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      displaySnackbar("Please enter your email address.", "error");
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        displaySnackbar(
          "Password reset instructions sent to your email.",
          "success"
        );

        // Navigate to Reset Password screen after success
        setTimeout(() => {
          router.push({
            pathname: "/auth/resetPassword",
            params: { email }, // Pass the email to Reset Password screen
          });
        }, 3000);
      } else {
        displaySnackbar(
          result.message || "Failed to process request.",
          "error"
        );
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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset
              your password.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
            >
              <Text style={styles.buttonText}>Send Reset Instructions</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        <View style={styles.snackbarContent}>
          <IconButton
            icon={icon}
            iconColor={messageType === "success" ? "#4CAF50" : "#F44336"}
            size={20}
          />
          <Text
            style={[
              styles.snackbarMessage,
              { color: messageType === "success" ? "#4CAF50" : "#F44336" },
            ]}
          >
            {message}
          </Text>
        </View>
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F8" },
  keyboardAvoid: { flex: 1 },
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    minHeight: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666 ",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  snackbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  snackbarContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  snackbarMessage: {
    marginLeft: 8,
    fontSize: 16,
  },
});

export default ForgotPassword;
