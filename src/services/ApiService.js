import {
  blobUrlToFile,
  dataUrlToFile,
  isBlobUrl,
  isDataUrl,
  isFile,
} from "../utils/FileUtil";

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
      const url = ApiService._currentCompany.icon;
      try {
        // Add cache busting to avoid cached CORS errors
        const fetchUrl = url.includes("?")
          ? `${url}&t=${Date.now()}`
          : `${url}?t=${Date.now()}`;
        const response = await fetch(fetchUrl, { mode: "cors" });
        if (!response.ok) return null;

        // Check content type to avoid using index.html as image (SPA fallback)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return null;
        }

        const blob = await response.blob();
        // Ensure it's an image
        if (!blob.type.startsWith("image/")) {
          return null;
        }

        // Use the company id as the filename
        return new File([blob], `${ApiService._currentCompany.id}.png`, {
          type: blob.type,
        });
      } catch (error) {
        console.warn("Failed to fetch company icon:", error);
        return null;
      }
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

        // Don't reload if we're already on the login page
        if (!window.location.pathname.includes("/staff/login")) {
          window.location.href = "/staff/login";
        }

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

  // PUT /api/auth/staff/company - Update Company Profile
  static async updateCompanyProfile(companyData) {
    return this.makeRequest("/api/auth/staff/company", {
      method: "PUT",
      body: JSON.stringify(companyData),
    });
  }

  // GET /api/internal/buildings - Get HK Buildings
  static async getBuildings(filter, startIndex = 0) {
    return this.makeRequest(`/api/internal/buildings?filter=${encodeURIComponent(filter)}&startIndex=${startIndex}`);
  }

  // GET /api/internal/districts - Get HK Districts
  static async getDistricts() {
    return this.makeRequest(`/api/internal/districts`);
  }

  // GET /api/industries - Get company industries
  static async getCompanyIndustries() {
    return this.makeRequest("/api/industries");
  }

  // POST /api/auth/staff/register - Staff Registration
  static async registerStaff(data) {
    return this.makeRequest("/api/auth/staff/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // PUT /api/auth/staff/profile - Update Staff Profile / Preferences
  static async updateStaffProfile(profileData) {
    return this.makeRequest("/api/auth/staff/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  }

  // POST /api/auth/staff/refresh-token - Refresh Staff Token
  static async refreshStaffToken(token) {
    // We use fetch directly here to avoid circular dependency with makeRequest's error handling
    // and because we need specific handling for this endpoint
    const response = await fetch(
      `${API_BASE_URL}/api/auth/staff/refresh-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

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

  // PUT /api/flyer/:flyerId - Update flyer details
  static async updateFlyer(flyerId, flyerData) {
    return this.makeRequest(`/api/flyer/${flyerId}`, {
      method: "PUT",
      body: JSON.stringify({ data: flyerData }),
    });
  }

  // GET /api/flyer/:flyerId - Get single flyer by ID
  static async getFlyerById(flyerId) {
    return this.makeRequest(`/api/flyer/${flyerId}`);
  }

  // GET /api/flyers - Get all flyers
  static async getFlyers(
    limit = 100,
    after = null,
    sortBy = "createdAt",
    direction = "desc",
    companyId = null,
  ) {
    let queryString = `limit=${limit}&sortBy=${sortBy}&direction=${direction}`;
    if (after) {
      queryString += `&after=${after}`;
    }
    if (companyId) {
      queryString += `&companyId=${companyId}`;
    }
    return this.makeRequest(`/api/flyers?${queryString}`);
  }

  static async getAdminUsers(limit = 100, direction = "desc") {
    return this.makeRequest(
      `/api/admin/users?limit=${limit}&direction=${direction}`,
    );
  }

  static async getAdminCompanies(limit = 100, direction = "desc") {
    return this.makeRequest(
      `/api/admin/companies?limit=${limit}&direction=${direction}`,
    );
  }

  static async getAdminVouchers(limit = 100, direction = "desc") {
    return this.makeRequest(
      `/api/admin/vouchers?limit=${limit}&direction=${direction}`,
    );
  }

  static async createAdminVoucher(voucherData) {
    return this.makeRequest("/api/admin/vouchers", {
      method: "POST",
      body: JSON.stringify(voucherData),
    });
  }

  static async getAdminFlyers(limit = 100, direction = "desc") {
    return this.makeRequest(
      `/api/admin/flyers?limit=${limit}&direction=${direction}`,
    );
  }

  // GET /api/company/me/coupons - Get reusable coupons for the current company
  static async getCompanyCouponLibrary() {
    return this.makeRequest("/api/company/me/coupons");
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
  static async generateLeaflet(leafletData, isProMode = false) {
    const formData = new FormData();

    // External endpoint (not using API_BASE_URL)
    let endpoint =
      "https://flyergenie-backend-91102396327.europe-west1.run.app/flyer/generate-multipart";
    if (isProMode) {
      endpoint =
        "https://flyergenie-backend-pro-91102396327.europe-west1.run.app/api/generate-image";
    }

    if (isProMode) {
      // Pro Mode Fields mapping
      formData.append("Product_Name", leafletData.productName || "");
      formData.append("Query_Context", leafletData.flyerPrompts || "");
      formData.append("Aspect_Ratio", leafletData.aspectRatio || "1:1");
      formData.append("Resolution", leafletData.resolution || "2K");
      formData.append(
        "Logo_Position",
        leafletData.logoPosition || "natural placement",
      );

      formData.append("Copy_Line", leafletData.header || "");
      formData.append(
        "Copy_Position",
        leafletData.copyPosition || "natural placement",
      );

      formData.append("Body_Copy", leafletData.bodyCopy || "");
      formData.append(
        "Body_Copy_Position",
        leafletData.bodyCopyPosition || "natural placement",
      );

      if (leafletData.primaryColor) {
        formData.append("Primary_Color", leafletData.primaryColor);
      }
      if (leafletData.secondaryColor) {
        formData.append("Secondary_Color", leafletData.secondaryColor);
      }
      if (leafletData.typography) {
        formData.append("Typography", leafletData.typography);
      }
      if (leafletData.brandVoice) {
        formData.append("Brand_Voice", leafletData.brandVoice);
      }
      if (leafletData.campaignMoodboard) {
        formData.append("Campaign_Moodboard", leafletData.campaignMoodboard);
      }

      // Handle Files for Pro Mode
      if (leafletData.logoImage && leafletData.logoImage.file) {
        formData.append("logo_image", leafletData.logoImage.file);
      } else {
        // Fallback to company icon if user didn't upload specific logo
        const companyIcon = await ApiService.getCurrentCompanyIconFile();
        if (companyIcon) {
          formData.append("logo_image", companyIcon);
        }
      }

      if (leafletData.referenceFlyer && leafletData.referenceFlyer.file) {
        formData.append(
          "reference_image_file",
          leafletData.referenceFlyer.file,
        );
      }

      // Pro Mode seems to support only one product image per readme field "product_image"
      // But standard leaflet supports multiple or 1. If multiple, maybe we just pick first?
      // README says "product_image: image file", singular.
      if (leafletData.productPhoto && leafletData.productPhoto.length > 0) {
        // Use the first one
        const photo = leafletData.productPhoto[0];
        if (photo.file) {
          formData.append("product_image", photo.file);
        }
      }
    } else {
      // Standard Mode Fields
      formData.append(
        "logo_image",
        await ApiService.getCurrentCompanyIconFile(),
      );
      if (leafletData.referenceFlyer && leafletData.referenceFlyer.file) {
        formData.append("template_image", leafletData.referenceFlyer.file);
      }
      formData.append("user_prompt", leafletData.promotionMessage);
      formData.append("flyer_ratio", leafletData.aspectRatio);
      formData.append(
        "flyer_text",
        JSON.stringify({
          header: leafletData.header,
          subheader: leafletData.subheader,
          content: null,
        }),
      );
      formData.append("company_info", localStorage.getItem("company") || "{}");
      formData.append("display_company_info", "false");
      formData.append("generation_id", crypto.randomUUID());
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // Let browser set Content-Type with boundary
      });
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (isProMode) {
        // Map Pro response to expected internal format
        // Pro response: { "prompt": "...", "image_urls": ["data:image/...", ...] }
        // Internal expected: { flyer_output_path: "url" }
        if (result.image_urls && result.image_urls.length > 0) {
          return {
            flyer_output_path: result.image_urls[0], // Take first image
            ...result,
          };
        }
      }

      return result;
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
      couponFile: data.couponFile,
      qrCodeImage: data.qrCodeImage,
      barcodeImage: data.barcodeImage,
    };

    // Remove undefined/null fields
    const filesToUpload = Object.fromEntries(
      Object.entries(fileFields).filter(([_, value]) => value != null),
    );

    if (Object.keys(filesToUpload).length === 0) {
      return {}; // No files to upload
    }

    // Process single file field
    const processFileField = async (key, value) => {
      if (!value) return null;

      let fileToUpload = null;

      if (isFile(value)) {
        fileToUpload = value;
      } else if (isDataUrl(value)) {
        fileToUpload = dataUrlToFile(value, `${key}_${Date.now()}.png`);
      } else if (isBlobUrl(value)) {
        fileToUpload = await blobUrlToFile(value, `${key}_${Date.now()}`);
      } else if (typeof value === "object" && value.file) {
        // Handle objects with file property (like from Step1Content)
        if (isFile(value.file)) {
          fileToUpload = value.file;
        } else if (isDataUrl(value.preview)) {
          fileToUpload = dataUrlToFile(
            value.preview,
            value.name || `${key}_${Date.now()}.png`,
          );
        } else if (isBlobUrl(value.preview)) {
          fileToUpload = await blobUrlToFile(
            value.preview,
            value.name || `${key}_${Date.now()}`,
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
