const express = require("express");
const bcrypt = require("bcryptjs");

module.exports = function createRegisterRouter(context) {
  const {
    db,
    normalizeEmail,
    isValidEmail,
    ALLOWED_STAFF_ROLES,
    INITIAL_COMPANY_TOKENS,
    createCompanyWallet,
    createCompanyWalletTransaction,
  } = context;

  const router = express.Router();

  router.post("/register", async (req, res) => {
    try {
      const {
        username,
        email,
        displayName,
        password,
        companyDisplayName,
        companyName,
        companyIcon,
        address,
        district,
        contact,
        role,
        companyNature,
        locale,
      } = req.body;
      const requestedRole = typeof role === "string" ? role.trim() : "staff";
      const normalizedEmail = normalizeEmail(email);

      if (!username || !normalizedEmail || !displayName || !password) {
        return res.status(400).json({
          success: false,
          message: "Username, email, display name, and password are required",
        });
      }

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      if (!ALLOWED_STAFF_ROLES.has(requestedRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff role",
        });
      }

      const existingStaffQuery = await db
        .collection("staffs")
        .where("username", "==", username)
        .limit(1)
        .get();

      if (!existingStaffQuery.empty) {
        return res.status(409).json({
          success: false,
          message: "Staff username already exists",
        });
      }

      const existingStaffEmailQuery = await db
        .collection("staffs")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!existingStaffEmailQuery.empty) {
        return res.status(409).json({
          success: false,
          message: "Staff email already exists",
        });
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const result = await db.runTransaction(async (transaction) => {
        let companyId = null;
        let companyData = null;
        const timestamp = new Date().toISOString();

        if (companyName) {
          const companyRef = db.collection("companies").doc();
          companyData = {
            companyDisplayName,
            name: companyName,
            icon: companyIcon,
            address,
            district,
            contact,
            nature: companyNature,
            createdAt: timestamp,
            updatedAt: timestamp,
            isActive: true,
          };
          transaction.set(companyRef, companyData);
          companyId = companyRef.id;

          const wallet = createCompanyWallet({
            transaction,
            companyId,
            companyName,
            companyDisplayName,
            initialBalance: INITIAL_COMPANY_TOKENS,
            timestamp,
          });

          createCompanyWalletTransaction({
            transaction,
            walletId: wallet.ref.id,
            companyId,
            type: "ADD",
            amount: INITIAL_COMPANY_TOKENS,
            previousBalance: 0,
            newBalance: INITIAL_COMPANY_TOKENS,
            description: "Company onboarding starter tokens",
            timestamp,
            metadata: {
              source: "company_onboarding",
            },
          });
        }

        const staffRef = db.collection("staffs").doc();
        const staffData = {
          username,
          email: normalizedEmail,
          displayName,
          password: hashedPassword,
          role: requestedRole,
          companyId,
          profile: {
            locale: locale || "en",
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          isActive: true,
        };

        transaction.set(staffRef, staffData);

        return {
          staffId: staffRef.id,
          staffData,
          companyId,
          companyData,
        };
      });

      const responseData = {
        id: result.staffId,
        username: result.staffData.username,
        email: result.staffData.email,
        displayName: result.staffData.displayName,
        role: result.staffData.role,
        companyId: result.companyId,
        createdAt: result.staffData.createdAt,
        isActive: result.staffData.isActive,
      };

      if (result.companyData) {
        responseData.company = {
          id: result.companyId,
          name: result.companyData.name,
        };
      }

      res.status(201).json({
        success: true,
        message: result.companyData
          ? `Staff registered successfully. ${INITIAL_COMPANY_TOKENS} starter tokens have been added to the company wallet.`
          : "Staff registered successfully",
        data: responseData,
      });
    } catch (error) {
      console.error("Error registering staff:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during staff registration",
        error: error.message,
      });
    }
  });

  return router;
};
