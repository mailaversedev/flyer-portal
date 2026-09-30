import { useEffect, useRef, useState } from "react";
import ApiService from "../services/ApiService";

export const KPAY_POLL_INTERVAL_MS = 2000;
export const KPAY_POLL_TIMEOUT_MS = 60000;

const storageKey = (purpose) => `kpayPending:${purpose}`;

export const rememberKpayPayment = (purpose, paymentId) => {
  // Persist before leaving the platform, including for older return URLs.
  sessionStorage.setItem(storageKey(purpose), paymentId);
};

export default function useKpayPayment({ purpose, onPaid }) {
  const [paymentId, setPaymentId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("kpayPaymentId") || sessionStorage.getItem(storageKey(purpose)) || "";
  });
  const [status, setStatus] = useState(paymentId ? "pending" : "idle");
  const [retryCount, setRetryCount] = useState(0);
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    if (!paymentId) return undefined;
    let cancelled = false;
    let timer;
    const startedAt = Date.now();
    setStatus("pending");

    const checkPayment = async () => {
      try {
        const response = await ApiService.getKpayOrder(paymentId);
        if (cancelled) return;
        if (!response?.success || response.data?.purpose !== purpose) {
          throw new Error("Unable to verify this payment");
        }
        const payment = response.data;
        if (payment.status === "PAID") {
          // Refresh balances before declaring the return flow complete.
          await onPaidRef.current(payment);
          if (cancelled) return;
          sessionStorage.removeItem(storageKey(purpose));
          const url = new URL(window.location.href);
          ["kpayPaymentId", "kpayResult", "kpayPurpose", "bundleCode"].forEach((key) => url.searchParams.delete(key));
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          setStatus("paid");
          return;
        }
        if (["FAILED", "CREATION_FAILED", "CANCELLED", "EXPIRED"].includes(payment.status)) {
          setStatus("failed");
          return;
        }
        if (Date.now() - startedAt >= KPAY_POLL_TIMEOUT_MS) {
          setStatus("timeout");
          return;
        }
        timer = window.setTimeout(checkPayment, KPAY_POLL_INTERVAL_MS);
      } catch (_error) {
        if (!cancelled) setStatus("error");
      }
    };
    checkPayment();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paymentId, purpose, retryCount]);

  return {
    status,
    paymentId,
    retry: () => setRetryCount((count) => count + 1),
    dismiss: () => {
      sessionStorage.removeItem(storageKey(purpose));
      const url = new URL(window.location.href);
      ["kpayPaymentId", "kpayResult", "kpayPurpose", "bundleCode"].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      setPaymentId("");
      setStatus("idle");
    },
  };
}