import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { toast } from "react-toastify";
import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css"; 

const PlatformAdminCreditRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [grantingId, setGrantingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await ApiService.getCreditRequests(); 
      if (res.success) {
        setRequests(res.data || []);
      } else {
        throw new Error(res.message || "Failed to fetch credit requests");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching credit requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleGrant = async (id) => {
    if (!window.confirm("Are you sure you want to grant this credit request?")) {
      return;
    }
    
    try {
      setGrantingId(id);
      const res = await ApiService.grantCreditRequest(id);
      if (res.success) {
        toast.success("Credit granted successfully");
        fetchRequests(); 
      } else {
        throw new Error(res.message || "Failed to grant credit");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error granting credit");
    } finally {
      setGrantingId(null);
    }
  };

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="platform-admin-page">
      <div className="campaign-table">
        <div className="table-container">
          {loading ? (
            <div className="table-loading">Loading credit requests...</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : requests.length === 0 ? (
            <div className="table-loading">No credit requests found.</div>
          ) : (
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Amount (HKD)</th>
                  <th>Method</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>{req.userId}</td>
                    <td>HK${Number(req.amount).toFixed(2)}</td>
                    <td>{req.paymentMethod}</td>
                    <td>
                      {req.receiptUrl ? (
                        <a href={req.receiptUrl} target="_blank" rel="noopener noreferrer" style={{color: '#4fc3f7'}}>
                          View
                        </a>
                      ) : (
                        "No Receipt"
                      )}
                    </td>
                    <td>
                      <span className={`status ${req.status === 'granted' ? 'live' : 'draft'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>{new Date(req.createdAt).toLocaleString()}</td>
                    <td>
                      {req.status === "pending" && (
                        <button
                          className="action-btn-primary"
                          onClick={() => handleGrant(req.id)}
                          disabled={grantingId === req.id}
                          style={{ padding: '6px 12px', background: '#4fc3f7', color: '#161c24', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {grantingId === req.id ? "Granting..." : "Grant"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdminCreditRequestsPage;
