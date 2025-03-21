import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Define types for the local params
interface PaymentParams {
  rideId: string;
  amount: string;
}

// Define types for payment data
interface PaymentData {
  paymentId: string;
  amount: string;
  productId: string;
  esewaPaymentUrl: string;
  successUrl: string;
  failureUrl: string;
  signature?: string;
}

const API_BASE_URL = 'http://192.168.1.70:3001/api';

const PaymentScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.rideId;
  const amount = params.amount;
  
  const [loading, setLoading] = useState<boolean>(true);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (rideId) {
      initiatePayment();
    } else {
      Alert.alert('Error', 'Invalid ride details');
      router.back();
    }
  }, [rideId]);
  
  const initiatePayment = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log(`Initiating payment for ride: ${rideId}`);
      
      const response = await axios.post(`${API_BASE_URL}/payments/initiate`, {
        rideId
      });
      
      console.log('Payment initiation response:', response.data);
      
      if (response.data.success) {
        setPaymentData(response.data.data);
        
        // Prepare eSewa form data
        const formData = {
          amount: response.data.data.amount,
          failure_url: response.data.data.failureUrl,
          product_delivery_charge: "0",
          product_service_charge: "0",
          product_code: response.data.data.productId,
          signature: response.data.data.signature || "test_signature", // Use the signature if provided
          signed_field_names: "total_amount,transaction_uuid,product_code",
          success_url: response.data.data.successUrl,
          tax_amount: "0",
          total_amount: response.data.data.amount,
          transaction_uuid: response.data.data.paymentId
        };
        
        // Create an HTML form for eSewa
        const htmlForm = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Processing Payment</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .loader { margin: 20px auto; border: 5px solid #f3f3f3; border-radius: 50%; border-top: 5px solid #3498db; width: 30px; height: 30px; animation: spin 2s linear infinite; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <h2>Redirecting to eSewa</h2>
            <div class="loader"></div>
            <p>Please wait...</p>
            <form id="esewaForm" method="POST" action="${response.data.data.esewaPaymentUrl}">
              ${Object.entries(formData).map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`).join('')}
            </form>
            <script>
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(function() {
                  document.getElementById('esewaForm').submit();
                }, 1500);
              });
            </script>
          </body>
          </html>
        `;
        
        setPaymentUrl(htmlForm);
        setLoading(false);
      } else {
        setError(`Failed to initiate payment: ${response.data.message}`);
        Alert.alert('Error', 'Failed to initiate payment');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      let errorMessage = 'Failed to connect to payment service';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error data:', error.response.data);
        console.error('Error status:', error.response.status);
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Error request:', error.request);
        errorMessage = 'No response from server';
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      setLoading(false);
    }
  };
  
  const handleWebViewNavigationStateChange = (newNavState: { url: string }): void => {
    const { url } = newNavState;
    
    console.log('WebView navigation state changed, URL:', url);
    
    // Check if the URL is one of our callback URLs
    if (url && (url.includes('/api/payments/success') || url.includes('/api/payments/failure'))) {
      // Handle the payment result
      if (url.includes('/success')) {
        // Extract refId if present
        const refId = url.includes('refId=') ? url.split('refId=')[1].split('&')[0] : null;
        console.log('Success URL detected, refId:', refId);
        
        // Update payment status on your server
        if (refId && paymentData) {
          verifyPayment(paymentData.paymentId, 'success', refId);
        } else {
          paymentSuccess();
        }
      } else {
        console.log('Failure URL detected');
        paymentFailure();
      }
    }
    
    // Handle deep links
    if (url && (url.includes('yourapp://payment/success') || url.includes('yourapp://payment/failure'))) {
      if (url.includes('/success')) {
        console.log('Success deep link detected');
        paymentSuccess();
      } else {
        console.log('Failure deep link detected');
        paymentFailure();
      }
    }
  };
  
  const verifyPayment = async (paymentId: string, status: string, refId: string): Promise<void> => {
    try {
      console.log(`Verifying payment. ID: ${paymentId}, Status: ${status}, RefID: ${refId}`);
      const response = await axios.post(`${API_BASE_URL}/payments/verify`, {
        paymentId,
        status,
        refId,
        transactionId: refId
      });
      
      console.log('Payment verification response:', response.data);
      
      if (status === 'success') {
        paymentSuccess();
      } else {
        paymentFailure();
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      paymentFailure();
    }
  };
  
  const paymentSuccess = (): void => {
    setShowWebView(false);
    Alert.alert(
      'Payment Successful',
      'Your payment has been processed successfully.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };
  
  const paymentFailure = (): void => {
    setShowWebView(false);
    Alert.alert(
      'Payment Failed',
      'We could not process your payment. Please try again.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };
  
  const startPayment = (): void => {
    setShowWebView(true);
  };
  
  const retryPayment = (): void => {
    setError(null);
    initiatePayment();
  };
  
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Preparing payment...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity 
          style={styles.payButton} 
          onPress={retryPayment}
        >
          <Text style={styles.payButtonText}>Retry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (showWebView && paymentUrl) {
    return (
      <WebView
        source={{ html: paymentUrl }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          Alert.alert('WebView Error', 'Failed to load payment gateway');
        }}
      />
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Details</Text>
      
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Amount:</Text>
          <Text style={styles.value}>Rs. {amount}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.label}>Payment Method:</Text>
          <Text style={styles.value}>eSewa</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.label}>Ride ID:</Text>
          <Text style={styles.value}>{rideId}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.payButton} 
        onPress={startPayment}
      >
        <Text style={styles.payButtonText}>Pay with eSewa</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  detailsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    color: '#555',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#10b981',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default PaymentScreen;