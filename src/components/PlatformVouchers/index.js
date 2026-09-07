export const DEFAULT_FORM = {
	merchant: "",
	value: "",
	cost: "",
	expiryDate: "",
	totalNumber: "",
	voucherType: "static",
	voucherPrefix: "",
	voucherNumberStart: "",
	voucherNumberEnd: "",
	promotionCode: "",
	terms: "",
	merchantIcon: "",
	voucherImage: "",
	qrCode: "",
	primaryColor: "#ef3239",
	secondaryColor: "#f76b1c",
};

export const formatDate = (value) => {
	if (!value) return "-";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};
