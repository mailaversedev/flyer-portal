// API service for flyer-portal

// API service for flyer-portal
const API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "" // Use relative URLs in production
    : "http://localhost:3000"; // Development server

class ApiService {
  static _currentCompany = null;

  static async getCurrentCompanyIconFile() {
    console.log("Getting icon for company:", ApiService._currentCompany);
    if (ApiService._currentCompany && ApiService._currentCompany.id) {
      const url = `/${ApiService._currentCompany.id}.png`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      // Use the company id as the filename
      return new File([blob], `${ApiService._currentCompany.id}.png`, {
        type: blob.type,
      });
    }
    return null;
  }

  // Set current company (called from Header)
  static setCurrentCompany(company) {
    ApiService._currentCompany = company;
  }

  // Get current company
  static getCurrentCompany() {
    return ApiService._currentCompany;
  }

  // Helper method for making API requests
  static async makeRequest(endpoint, options = {}) {
    try {
      const token = localStorage.getItem("token");

      const defaultHeaders = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

      // Remove Content-Type header for FormData requests
      if (options.body instanceof FormData) {
        delete defaultHeaders["Content-Type"];
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: defaultHeaders,
        ...options,
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("company");
        window.location.href = "/staff/login";
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // POST /api/auth/staff/login - Staff Login
  static async loginStaff(username, password) {
    return this.makeRequest("/api/auth/staff/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  // POST /api/auth/staff/register - Staff Registration
  static async registerStaff(data) {
    return this.makeRequest("/api/auth/staff/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // POST /api/auth/staff/refresh-token - Refresh Staff Token
  static async refreshStaffToken(token) {
    // We use fetch directly here to avoid circular dependency with makeRequest's error handling
    // and because we need specific handling for this endpoint
    const response = await fetch(`${API_BASE_URL}/api/auth/staff/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If refresh fails (401/404), the caller should handle logout
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  }

  // POST /api/flyer - Create flyer (leaflet, query, or qr code)
  static async createFlyer(flyerData) {
    return this.makeRequest("/api/flyer", {
      method: "POST",
      body: JSON.stringify(flyerData),
    });
  }

  // POST /api/file - Upload file/image
  static async uploadFile(file, category = "general") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    return this.makeRequest("/api/file", {
      method: "POST",
      body: formData,
    });
  }

  // POST /api/leaflet - Generate leaflet
  static async generateLeaflet(leafletData) {
    const formData = new FormData();
    formData.append("logo_image", await ApiService.getCurrentCompanyIconFile());
    formData.append("template_image", leafletData.referenceFlyer.file);
    formData.append("user_prompt", leafletData.promotionMessage);
    formData.append("flyer_ratio", leafletData.aspectRatio);
    formData.append(
      "flyer_text",
      JSON.stringify({
        header: leafletData.header,
        subheader: leafletData.subheader,
        content: null,
      })
    );
    formData.append("company_info", localStorage.getItem("company") || "{}");
    formData.append("display_company_info", "false");
    formData.append("generation_id", crypto.randomUUID());

    // External endpoint (not using API_BASE_URL)
    const endpoint =
      "https://flyergenie-backend-91102396327.europe-west1.run.app/flyer/generate-multipart";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // Let browser set Content-Type with boundary
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("FlyerGenie API Request failed:", error);
      throw error;
    }
  }

  // Helper method to upload only file fields and return their URLs
  static async uploadFilesFromData(data) {
    // Extract only file-related fields
    const fileFields = {
      coverPhoto: data.coverPhoto,
      backgroundPhoto: data.backgroundPhoto,
      referenceLayer: data.referenceLayer,
      productPhotos: data.productPhotos,
      productPhoto: data.productPhoto,
      images: data.images,
      couponFile: data.couponFile
    };

    // Remove undefined/null fields
    const filesToUpload = Object.fromEntries(
      Object.entries(fileFields).filter(([_, value]) => value != null)
    );

    if (Object.keys(filesToUpload).length === 0) {
      return {}; // No files to upload
    }

    // Helper function to check if a value is a File object
    const isFile = (value) => value instanceof File;

    // Helper function to check if a value is a data URL (base64)
    const isDataUrl = (value) =>
      typeof value === "string" && value.startsWith("data:");

    // Convert data URL to File object
    const dataUrlToFile = (dataUrl, filename = "image.png") => {
      const arr = dataUrl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    };

    // Process single file field
    const processFileField = async (key, value) => {
      if (!value) return null;

      let fileToUpload = null;

      if (isFile(value)) {
        fileToUpload = value;
      } else if (isDataUrl(value)) {
        fileToUpload = dataUrlToFile(value, `${key}_${Date.now()}.png`);
      } else if (typeof value === "object" && value.file) {
        // Handle objects with file property (like from Step1Content)
        if (isFile(value.file)) {
          fileToUpload = value.file;
        } else if (isDataUrl(value.preview)) {
          fileToUpload = dataUrlToFile(
            value.preview,
            value.name || `${key}_${Date.now()}.png`
          );
        }
      }

      if (fileToUpload) {
        try {
          const uploadResponse = await this.uploadFile(fileToUpload, key);
          return uploadResponse.success ? uploadResponse.url : null;
        } catch (error) {
          console.error(`Failed to upload ${key}:`, error);
          return null;
        }
      }

      return null;
    };

    // Process array of files
    const processFileArray = async (key, array) => {
      if (!Array.isArray(array)) return null;

      const uploadPromises = array.map(async (item, index) => {
        const result = await processFileField(`${key}_${index}`, item);
        return result;
      });

      const results = await Promise.all(uploadPromises);
      return results.filter((url) => url !== null); // Remove failed uploads
    };

    const uploadedUrls = {};

    // Upload each file field
    for (const [key, value] of Object.entries(filesToUpload)) {
      if (Array.isArray(value)) {
        const urls = await processFileArray(key, value);
        if (urls.length > 0) {
          uploadedUrls[key] = urls;
        }
      } else {
        const url = await processFileField(key, value);
        if (url) {
          uploadedUrls[key] = url;
        }
      }
    }

    return uploadedUrls; // Return only the uploaded URLs
  }

  // Helper method to prepare file data for upload
  static async uploadFileFromInput(file, category = "general") {
    // Direct file upload using FormData - no need for base64 conversion
    return this.uploadFile(file, category);
  }
}

export default ApiService;
