import React, { useState } from "react";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";
import "./CreditRequestModal.css";

const CreditRequestModal = ({ onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!file) {
      toast.error("Please upload a receipt.");
      return;
    }

    try {
      setLoading(true);

      // 1. Upload receipt
      const uploadRes = await ApiService.uploadFile(file, "receipts");
      if (!uploadRes.success || !uploadRes.url) {
        throw new Error("Failed to upload receipt");
      }

      // 2. Submit credit request
      const requestRes = await ApiService.submitCreditRequest({
        amount: Number(amount),
        paymentMethod,
        receiptUrl: uploadRes.url,
      });

      if (!requestRes.success) {
        throw new Error(requestRes.message || "Failed to submit request");
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="credit-request-modal-overlay">
      <div className="credit-request-modal">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>Request Credit</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Request Amount (HKD)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="fps">FPS</option>
              <option value="payme">PayMe</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div className="form-group">
            <label>Upload Receipt</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreditRequestModal;
