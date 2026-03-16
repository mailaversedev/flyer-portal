export const isValidHexColor = (value) =>
  /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(value);

export const normalizePickerColor = (value) => {
  if (isValidHexColor(value)) {
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }

    return value;
  }

  return "#ffffff";
};
