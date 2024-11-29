// Create a new utility file
// utils/deviceDetect.js

export const getDeviceType = () => {
  // Check if we're on the client side
  if (typeof window === "undefined") {
    return {
      type: "desktop",

      isLowEndDevice: false,
    };
  }

  // Check for mobile device using userAgent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Check memory if available (Chrome/Edge only)
  const deviceMemory = navigator?.deviceMemory || 8; // Default to 8GB if not available

  if (/android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent)) {
    return {
      type: "mobile",
      memory: deviceMemory,
      isLowEndDevice: true,
    };
  }

  return {
    type: "desktop",
    memory: deviceMemory,
    isLowEndDevice: deviceMemory <= 4,
  };
};
