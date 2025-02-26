import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
  Alert,
} from "react-native";
import axios from "axios";

const { width } = Dimensions.get("window");
const THUMBNAIL_SIZE = (width - 80) / 4;
const API_BASE_URL = "http://192.168.1.70:3001"; // Update this with your API URL

interface Driver {
  _id: string;
  fullName: string;
  email: string;
  citizenshipNumber?: string;
  status: "pending" | "approved" | "rejected";
  photo?: string;
  frontPhoto?: string;
  backPhoto?: string;
  vehiclePhoto?: string;
  vehicleDetailPhoto?: string;
  renewalDetailPhoto?: string;
  ownerDetailPhoto?: string;
}

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string;
  title: string;
  onClose: () => void;
}

interface DriverCardProps {
  driver: Driver;
  onApproval: (
    driverId: string,
    status: "approved" | "rejected"
  ) => Promise<void>;
  isProcessing: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  imageUrl,
  title,
  onClose,
}) => (
  <Modal visible={visible} transparent={true} animationType="fade">
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  </Modal>
);

const ImageThumbnail: React.FC<{
  url: string;
  title: string;
  onPress: () => void;
}> = ({ url, title, onPress }) => (
  <TouchableOpacity
    style={styles.thumbnailContainer}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Image source={{ uri: url }} style={styles.thumbnail} resizeMode="cover" />
    <Text style={styles.thumbnailLabel} numberOfLines={1}>
      {title}
    </Text>
  </TouchableOpacity>
);

const DriverCard: React.FC<DriverCardProps> = ({
  driver,
  onApproval,
  isProcessing,
}) => {
  const [showImages, setShowImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const getDocumentCount = () => {
    const photos = [
      driver.photo,
      driver.frontPhoto,
      driver.backPhoto,
      driver.vehiclePhoto,
      driver.vehicleDetailPhoto,
      driver.renewalDetailPhoto,
      driver.ownerDetailPhoto,
    ];
    return photos.filter(Boolean).length;
  };

  const renderImage = (
    photoUrl: string | undefined,
    title: string,
    key: string
  ) => {
    if (!photoUrl) return null;

    const fullUrl = `${API_BASE_URL}${photoUrl}`;
    return (
      <ImageThumbnail
        key={key}
        url={fullUrl}
        title={title}
        onPress={() =>
          setSelectedImage({
            url: fullUrl,
            title: title,
          })
        }
      />
    );
  };

  return (
    <View style={styles.driverCard}>
      <View style={styles.driverHeader}>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driver.fullName}</Text>
          <Text style={styles.driverEmail}>{driver.email}</Text>
          {driver.citizenshipNumber && (
            <Text style={styles.driverCitizenship}>
              ID: {driver.citizenshipNumber}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            driver.status === "approved"
              ? styles.acceptedBadge
              : driver.status === "rejected"
              ? styles.rejectedBadge
              : styles.pendingBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.documentsButton}
        onPress={() => setShowImages(!showImages)}
      >
        <Text style={styles.documentsButtonText}>
          {getDocumentCount()} Documents {showImages ? "▼" : "▶"}
        </Text>
      </TouchableOpacity>

      {showImages && (
        <View style={styles.imagesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imagesScroll}
            contentContainerStyle={styles.imagesScrollContent}
          >
            {renderImage(driver.photo, "Profile Photo", "profile")}
            {renderImage(driver.frontPhoto, "License Front", "license-front")}
            {renderImage(driver.backPhoto, "License Back", "license-back")}
            {renderImage(driver.vehiclePhoto, "Vehicle Photo", "vehicle")}
            {renderImage(
              driver.vehicleDetailPhoto,
              "Vehicle Details",
              "vehicle-details"
            )}
            {renderImage(
              driver.renewalDetailPhoto,
              "Renewal Details",
              "renewal-details"
            )}
            {renderImage(
              driver.ownerDetailPhoto,
              "Owner Details",
              "owner-details"
            )}
          </ScrollView>
        </View>
      )}

      {driver.status === "pending" && (
        <View style={styles.buttonContainer}>
          {isProcessing ? (
            <ActivityIndicator color="#0066cc" style={styles.buttonSpinner} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={() => onApproval(driver._id, "approved")}
              >
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={() => onApproval(driver._id, "rejected")}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {selectedImage && (
        <ImageViewer
          visible={!!selectedImage}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </View>
  );
};

const AdminDashboard: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      // Fetch all drivers, not just pending ones
      const response = await axios.get(`${API_BASE_URL}/driver/drivers`); // Update this endpoint to fetch all drivers
      setDrivers(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch drivers.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (
    driverId: string,
    status: "approved" | "rejected"
  ) => {
    setProcessingIds((prev) => new Set(prev).add(driverId));
    try {
      await axios.post(`${API_BASE_URL}/admin/approve-driver`, {
        driverId,
        status,
      });

      // After approval, fetch the updated list of drivers
      fetchDrivers();

      Alert.alert("Success", `Driver ${status} successfully.`);
    } catch (error) {
      Alert.alert("Error", "Failed to update driver status.");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(driverId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  const pendingDrivers = drivers.filter((d) => d.status === "pending");
  const approvedDrivers = drivers.filter((d) => d.status === "approved");

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.header}>Driver Verification Dashboard</Text>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>
            Pending Verification ({pendingDrivers.length})
          </Text>
          {pendingDrivers.map((driver) => (
            <DriverCard
              key={driver._id}
              driver={driver}
              onApproval={handleApproval}
              isProcessing={processingIds.has(driver._id)}
            />
          ))}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>
            Approved Drivers ({approvedDrivers.length})
          </Text>
          {approvedDrivers.map((driver) => (
            <DriverCard
              key={driver._id}
              driver={driver}
              onApproval={handleApproval}
              isProcessing={processingIds.has(driver._id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
    color: "#333",
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  driverCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  driverEmail: {
    fontSize: 14,
    color: "#666",
  },
  driverCitizenship: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  pendingBadge: {
    backgroundColor: "#fff3e0",
  },
  acceptedBadge: {
    backgroundColor: "#e6f4ea",
  },
  rejectedBadge: {
    backgroundColor: "#fdeded",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  documentsButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  documentsButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  imagesContainer: {
    marginTop: 12,
  },
  imagesScroll: {
    marginHorizontal: -8,
  },
  imagesScrollContent: {
    paddingHorizontal: 8,
  },
  thumbnailContainer: {
    marginHorizontal: 4,
    width: THUMBNAIL_SIZE,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  thumbnailLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  buttonSpinner: {
    flex: 1,
    height: 44,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: "#34a853",
  },
  rejectButton: {
    backgroundColor: "#ea4335",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});

export default AdminDashboard;
