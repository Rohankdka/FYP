import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";

interface VehicleFormData {
  vehicleType: string;
  numberPlate: string;
  productionYear: string;
  vehiclePhoto: string | null;
  vehicleDetailPhoto: string | null;
  ownerDetailPhoto: string | null;
  renewalDetailPhoto: string | null;
  driverId: string;
}

const VehicleInformationForm = () => {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<VehicleFormData>({
    vehicleType: "",
    numberPlate: "",
    productionYear: "",
    vehiclePhoto: null,
    vehicleDetailPhoto: null,
    ownerDetailPhoto: null,
    renewalDetailPhoto: null,
    driverId: driverId as string,
  });

  // Request permissions at the start of the component
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions."
        );
      }
    };
    requestPermissions();
  }, []);

  const pickImage = async (
    field:
      | "vehiclePhoto"
      | "vehicleDetailPhoto"
      | "ownerDetailPhoto"
      | "renewalDetailPhoto"
  ) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setForm((prev) => ({ ...prev, [field]: result.assets[0].uri }));
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

  const validateForm = () => {
    return Object.entries(form).every(
      ([key, value]) => key === "driverId" || value
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Error", "Please fill out all fields and upload all photos.");
      return;
    }

    setLoading(true);
    const formData = new FormData();

    // Append text fields
    formData.append("vehicleType", form.vehicleType);
    formData.append("numberPlate", form.numberPlate);
    formData.append("productionYear", form.productionYear);
    formData.append("driverId", form.driverId);

    // Append photos
    const appendPhotoToFormData = async (
      field: string,
      uri: string | null,
      fileName: string
    ) => {
      if (uri) {
        try {
          const blob = await getBlobFromUri(uri);
          const file = new File([blob], fileName, { type: blob.type });
          formData.append(field, file as any); // Cast to 'any' to avoid TypeScript errors
        } catch (error) {
          Alert.alert("Error", `Failed to process ${field}`);
        }
      }
    };

    try {
      await appendPhotoToFormData(
        "vehiclePhoto",
        form.vehiclePhoto,
        "vehiclePhoto.jpg"
      );
      await appendPhotoToFormData(
        "vehicleDetailPhoto",
        form.vehicleDetailPhoto,
        "vehicleDetailPhoto.jpg"
      );
      await appendPhotoToFormData(
        "ownerDetailPhoto",
        form.ownerDetailPhoto,
        "ownerDetailPhoto.jpg"
      );
      await appendPhotoToFormData(
        "renewalDetailPhoto",
        form.renewalDetailPhoto,
        "renewalDetailPhoto.jpg"
      );

      const response = await axios.post(
        "http://192.168.1.70:3001/driver/vehicleinfo",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Alert.alert("Success", response.data.message);
      router.replace({
        pathname: "/DriverForm/LicenseInformationForm",
        params: { driverId },
      });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data.message ?? "Failed to save vehicle information"
        : "An unexpected error occurred";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    key: keyof VehicleFormData,
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
      />
    </View>
  );

  const renderImagePicker = (
    field:
      | "vehiclePhoto"
      | "vehicleDetailPhoto"
      | "ownerDetailPhoto"
      | "renewalDetailPhoto",
    label: string
  ) => (
    <View style={styles.imagePickerContainer}>
      <TouchableOpacity
        style={styles.imageButton}
        onPress={() => pickImage(field)}
        activeOpacity={0.8}
      >
        <Text style={styles.imageButtonText}>
          {form[field] ? "Change" : "Upload"} {label}
        </Text>
      </TouchableOpacity>
      {form[field] && (
        <Image source={{ uri: form[field] }} style={styles.image} />
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.header}>Vehicle Information</Text>
        <Text style={styles.subtitle}>Please provide your vehicle details</Text>

        {renderInput("vehicleType", "Vehicle Type")}
        {renderInput("numberPlate", "Number Plate")}
        {renderInput("productionYear", "Production Year", "numeric")}

        <Text style={styles.sectionTitle}>Vehicle Photos</Text>
        {renderImagePicker("vehiclePhoto", "Vehicle Photo")}
        {renderImagePicker("vehicleDetailPhoto", "Vehicle Detail Photo")}
        {renderImagePicker("ownerDetailPhoto", "Owner Detail Photo")}
        {renderImagePicker("renewalDetailPhoto", "Renewal Detail Photo")}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
  );
};
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 24,
    marginBottom: 16,
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
  imagePickerContainer: {
    marginBottom: 20,
  },
  imageButton: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  imageButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
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

export default VehicleInformationForm;
