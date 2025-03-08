import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import axios from "axios";

interface FormData {
  fullName: string;
  address: string;
  email: string;
  gender: string;
  dob: string;
  citizenshipNumber: string;
  photo: string | null;
  userId: string; // Add userId to the form data
}

const PersonalInformationForm = () => {
  const { email, userId } = useLocalSearchParams(); // Get email and userId from navigation params
  const [form, setForm] = useState<FormData>({
    fullName: "",
    address: "",
    email: email as string, // Pre-fill email from registration
    gender: "",
    dob: "",
    citizenshipNumber: "",
    photo: null,
    userId: userId as string, // Pre-fill userId
  });
  const [loading, setLoading] = useState(false);

  // Pick image from the device's gallery
  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setForm((prev) => ({ ...prev, photo: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSubmit = async () => {
    console.log("Submit button clicked");

    // Validate required fields
    if (
      !form.fullName ||
      !form.address ||
      !form.gender ||
      !form.dob ||
      !form.citizenshipNumber ||
      !form.photo ||
      !form.userId
    ) {
      console.log("Validation failed: Missing fields");
      Alert.alert("Error", "Please fill out all fields and upload a photo.");
      return;
    }

    console.log("Form validated successfully");
    setLoading(true);

    // Prepare FormData
    const formData = new FormData();
    formData.append("fullName", form.fullName);
    formData.append("address", form.address);
    formData.append("email", form.email);
    formData.append("gender", form.gender);
    formData.append("dob", form.dob);
    formData.append("citizenshipNumber", form.citizenshipNumber);
    formData.append("userId", form.userId);

    // Append the photo file
    if (form.photo) {
      const filename = form.photo.split("/").pop(); // Extract filename from URI
      const match = /\.(\w+)$/.exec(filename || ""); // Extract file extension
      const type = match ? `image/${match[1]}` : "image"; // Determine MIME type

      formData.append("photo", {
        uri: form.photo,
        name: filename || "photo.jpg",
        type,
      } as any); // Use `as any` to avoid TypeScript errors
    }

    console.log("Form Data:", formData); // Log FormData

    try {
      console.log("Sending request to backend...");
      const response = await axios.post(
        "http://192.168.1.70:3001/driver/personalinfo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Backend response:", response.data);
      Alert.alert("Success", response.data.message);

      // Redirect to the next screen
      const driverId = response.data.driver._id;
      router.push({
        pathname: "/DriverForm/VehicleInformationForm",
        params: { driverId },
      });
    } catch (error) {
      console.error("Submission error:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data.message ?? "Failed to save information"
        : "An unexpected error occurred";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };
  // Render input fields
  const renderInput = (
    key: keyof FormData,
    placeholder: string,
    keyboardType: any = "default"
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{placeholder}</Text>
      <TextInput
        style={styles.input}
        placeholder={`Enter ${placeholder.toLowerCase()}`}
        value={form[key] as string}
        onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
        keyboardType={keyboardType}
        placeholderTextColor="#666"
        editable={key !== "email" && key !== "userId"} // Disable editing for email and userId
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.header}>Personal Information</Text>
          <Text style={styles.subtitle}>Please fill in your details below</Text>

          {renderInput("fullName", "Full Name")}
          {renderInput("address", "Address")}
          {renderInput("email", "Email", "email-address")}
          {renderInput("gender", "Gender")}
          {renderInput("dob", "Date of Birth")}
          {renderInput("citizenshipNumber", "Citizenship Number")}

          <TouchableOpacity
            style={styles.imageButton}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <Text style={styles.imageButtonText}>
              {form.photo ? "Change Photo" : "Upload Photo"}
            </Text>
          </TouchableOpacity>

          {form.photo && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: form.photo }} style={styles.image} />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  imageButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 16,
  },
  imageButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  imageContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#3b82f6",
  },
  submitButton: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PersonalInformationForm;
