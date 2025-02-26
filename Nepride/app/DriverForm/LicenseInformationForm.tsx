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
import { router, useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";

interface FormData {
  licenseNumber: string;
  driverId: string;
  frontPhoto: string | null;
  backPhoto: string | null;
}

const LicenseInformationForm = () => {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    licenseNumber: "",
    driverId: driverId as string,
    frontPhoto: null,
    backPhoto: null,
  });
  const [loading, setLoading] = useState(false);

  const pickImage = async (type: "frontPhoto" | "backPhoto") => {
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
        setForm((prev) => ({ ...prev, [type]: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const getBlobFromUri = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  };

  const handleSubmit = async () => {
    if (
      !form.licenseNumber ||
      !form.frontPhoto ||
      !form.backPhoto ||
      !form.driverId
    ) {
      Alert.alert(
        "Error",
        "Please fill out all fields and upload both photos."
      );
      return;
    }

    setLoading(true);
    const formData = new FormData();

    formData.append("licenseNumber", form.licenseNumber);
    formData.append("driverId", form.driverId);

    try {
      if (form.frontPhoto) {
        const frontBlob = await getBlobFromUri(form.frontPhoto);
        formData.append("frontPhoto", frontBlob, "frontPhoto.jpg");
      }

      if (form.backPhoto) {
        const backBlob = await getBlobFromUri(form.backPhoto);
        formData.append("backPhoto", backBlob, "backPhoto.jpg");
      }

      const response = await axios.post(
        "http://192.168.1.70:3001/driver/licenseinfo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Alert.alert("Success", response.data.message);
      Alert.alert("Success", response.data.message);
      router.replace("/auth/login");
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data.message ?? "Failed to save information"
        : "An unexpected error occurred";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.header}>License Information</Text>
          <Text style={styles.subtitle}>
            Please provide your license details
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>License Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter license number"
              value={form.licenseNumber}
              onChangeText={(text) =>
                setForm((prev) => ({ ...prev, licenseNumber: text }))
              }
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.label}>License Front Photo</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => pickImage("frontPhoto")}
              activeOpacity={0.8}
            >
              <Text style={styles.imageButtonText}>
                {form.frontPhoto ? "Change Front Photo" : "Upload Front Photo"}
              </Text>
            </TouchableOpacity>
            {form.frontPhoto && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: form.frontPhoto }} style={styles.image} />
              </View>
            )}
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.label}>License Back Photo</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => pickImage("backPhoto")}
              activeOpacity={0.8}
            >
              <Text style={styles.imageButtonText}>
                {form.backPhoto ? "Change Back Photo" : "Upload Back Photo"}
              </Text>
            </TouchableOpacity>
            {form.backPhoto && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: form.backPhoto }} style={styles.image} />
              </View>
            )}
          </View>

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

// Add your styles here
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  card: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageButton: {
    backgroundColor: "#007BFF",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  imageButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  imageContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default LicenseInformationForm;
