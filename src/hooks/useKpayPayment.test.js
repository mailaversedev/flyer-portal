import { act, renderHook } from "@testing-library/react";
import ApiService from "../services/ApiService";
import useKpayPayment, { KPAY_POLL_INTERVAL_MS, KPAY_POLL_TIMEOUT_MS, rememberKpayPayment } from "./useKpayPayment";

jest.mock("../services/ApiService", () => ({
  __esModule: true,
  default: { getKpayOrder: jest.fn() },
}));

const purpose = "bundle_purchase";
const paymentId = "a".repeat(64);
const response = (status) => ({ success: true, data: { paymentId, purpose, status } });
const flush = async () => { await act(async () => {}); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/wallet");
});
afterEach(() => jest.useRealTimers());

test("does not treat a success query flag as proof of payment", async () => {
  window.history.replaceState({}, "", "/wallet?kpayResult=success");
  const onPaid = jest.fn();
  const { result } = renderHook(() => useKpayPayment({ purpose, onPaid }));
  await flush();
  expect(result.current.status).toBe("idle");
  expect(onPaid).not.toHaveBeenCalled();
});

test("disabled creation flow ignores stale pending payment and return URL", async () => {
  window.history.replaceState({}, "", `/wallet?kpayPaymentId=${paymentId}`);
  rememberKpayPayment(purpose, paymentId);
  const onPaid = jest.fn();
  const { result } = renderHook(() => useKpayPayment({ purpose, onPaid, enabled: false }));
  await flush();
  expect(result.current.status).toBe("idle");
  expect(result.current.paymentId).toBe("");
  expect(ApiService.getKpayOrder).not.toHaveBeenCalled();
  expect(onPaid).not.toHaveBeenCalled();
});

test("disabling a restored flow cancels polling and ignores an in-flight response", async () => {
  let resolvePayment;
  ApiService.getKpayOrder.mockReturnValue(new Promise((resolve) => { resolvePayment = resolve; }));
  const onPaid = jest.fn();
  const { result, rerender } = renderHook(({ enabled }) =>
    useKpayPayment({ purpose, onPaid, enabled, paymentId }),
    { initialProps: { enabled: true } },
  );
  rerender({ enabled: false });
  await act(async () => { resolvePayment(response("PAID")); });
  expect(result.current.status).toBe("idle");
  expect(onPaid).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(KPAY_POLL_TIMEOUT_MS); });
  expect(ApiService.getKpayOrder).toHaveBeenCalledTimes(1);
});

test("polls until server confirms PAID, refreshes once and cleans return URL", async () => {
  window.history.replaceState({ preserved: true }, "", `/wallet?kpayPaymentId=${paymentId}&kpayResult=success&other=keep`);
  rememberKpayPayment(purpose, paymentId);
  ApiService.getKpayOrder.mockResolvedValueOnce(response("PENDING")).mockResolvedValueOnce(response("PAID"));
  const onPaid = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useKpayPayment({ purpose, onPaid }));
  await flush();
  expect(result.current.status).toBe("pending");
  expect(onPaid).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(KPAY_POLL_INTERVAL_MS); });
  expect(result.current.status).toBe("paid");
  expect(onPaid).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(`kpayPending:${purpose}`)).toBeNull();
  expect(window.location.search).toBe("?other=keep");
  expect(window.history.state).toEqual({ preserved: true });
  await act(async () => { jest.advanceTimersByTime(KPAY_POLL_INTERVAL_MS * 2); });
  expect(ApiService.getKpayOrder).toHaveBeenCalledTimes(2);
});

test("timeout retains payment for retry without a new checkout", async () => {
  rememberKpayPayment(purpose, paymentId);
  ApiService.getKpayOrder.mockResolvedValue(response("PENDING"));
  const onPaid = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useKpayPayment({ purpose, onPaid }));
  await flush();
  for (let elapsed = 0; elapsed < KPAY_POLL_TIMEOUT_MS; elapsed += KPAY_POLL_INTERVAL_MS) {
    await act(async () => { jest.advanceTimersByTime(KPAY_POLL_INTERVAL_MS); });
  }
  expect(result.current.status).toBe("timeout");
  expect(sessionStorage.getItem(`kpayPending:${purpose}`)).toBe(paymentId);
  ApiService.getKpayOrder.mockResolvedValue(response("PAID"));
  await act(async () => { result.current.retry(); });
  expect(result.current.status).toBe("paid");
  expect(onPaid).toHaveBeenCalledTimes(1);
});

test("failed payment never triggers success and can be dismissed", async () => {
  rememberKpayPayment(purpose, paymentId);
  ApiService.getKpayOrder.mockResolvedValue(response("FAILED"));
  const onPaid = jest.fn();
  const { result } = renderHook(() => useKpayPayment({ purpose, onPaid }));
  await flush();
  expect(result.current.status).toBe("failed");
  expect(onPaid).not.toHaveBeenCalled();
  act(() => result.current.dismiss());
  expect(result.current.status).toBe("idle");
});

test("network error is recoverable and unmount cancels scheduled polling", async () => {
  rememberKpayPayment(purpose, paymentId);
  ApiService.getKpayOrder.mockRejectedValueOnce(new Error("Offline"));
  const { result, unmount } = renderHook(() => useKpayPayment({ purpose, onPaid: jest.fn() }));
  await flush();
  expect(result.current.status).toBe("error");
  ApiService.getKpayOrder.mockResolvedValue(response("PENDING"));
  await act(async () => { result.current.retry(); });
  expect(result.current.status).toBe("pending");
  unmount();
  await act(async () => { jest.advanceTimersByTime(KPAY_POLL_TIMEOUT_MS); });
  expect(ApiService.getKpayOrder).toHaveBeenCalledTimes(2);
});