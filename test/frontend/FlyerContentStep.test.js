import React, { createRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import FlyerContentStep from "../../src/components/Flyer/FlyerContentStep";
import Step1ContentPro from "../../src/components/Flyer/Leaflet/Step1ContentPro";
import { createCreativeDefaults } from "../../src/utils/FlyerContentUtil";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));

function Editor({ editorRef, ...props }) {
  const [data, setData] = useState(createCreativeDefaults("4:5", "2K"));
  return <FlyerContentStep ref={editorRef} data={data} onUpdate={setData} {...props} />;
}

beforeEach(() => jest.clearAllMocks());

test("the shared editor preserves Read validation and editable content", () => {
  const ref = createRef();
  render(<Editor editorRef={ref} />);
  expect(screen.getByLabelText("leafletPro.aspectRatio")).toHaveValue("4:5");
  expect(screen.getByLabelText("leafletPro.resolution")).toHaveValue("2K");
  act(() => expect(ref.current.validateRequiredFields()).toBe(false));
  expect(screen.getByText("Header is required")).toBeInTheDocument();
  expect(screen.getByText("Ad Content is required")).toBeInTheDocument();
  expect(screen.getByText("Context/Prompts is required")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("leafletPro.copyLine"), { target: { value: "Title" } });
  fireEvent.change(screen.getByLabelText("leafletPro.adContent"), { target: { value: "Description" } });
  fireEvent.change(screen.getByLabelText("leafletPro.prompts"), { target: { value: "Design a sale" } });
  act(() => expect(ref.current.validateRequiredFields()).toBe(true));
  expect(Step1ContentPro.validateRequiredFields({})).toEqual(expect.objectContaining({ isValid: false }));
});

test("upload mode retains copy but hides generation-only fields and accepts its validation policy", () => {
  URL.createObjectURL = jest.fn(() => "blob:cover");
  URL.revokeObjectURL = jest.fn();
  const ref = createRef();
  render(<Editor
    editorRef={ref}
    uploadedFile={new File(["image"], "cover.png", { type: "image/png" })}
    onFileSelect={jest.fn()}
    getValidationErrors={() => ({})}
  />);
  expect(screen.getByLabelText("leafletPro.copyLine")).toBeInTheDocument();
  expect(screen.queryByLabelText("leafletPro.prompts")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("leafletPro.resolution")).not.toBeInTheDocument();
  act(() => expect(ref.current.validateRequiredFields()).toBe(true));
  expect(screen.getByText("cover.png")).toBeInTheDocument();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test("tag Enter does not submit an enclosing event-style form", () => {
  const submit = jest.fn();
  render(<form onSubmit={submit}><Editor /></form>);
  const input = screen.getByPlaceholderText("qrGeneration.pleaseEnter");
  fireEvent.change(input, { target: { value: "summer" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  expect(screen.getByText("#summer")).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});

test("a prepared cover does not add a Step 1 preview sidebar", () => {
  const { container } = render(<FlyerContentStep
    data={{ ...createCreativeDefaults(), coverPhoto: "https://example.com/cover.png" }}
    onUpdate={jest.fn()}
    onFileSelect={jest.fn()}
  />);
  expect(container.querySelector(".flyer-content-preview")).toBeNull();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "qrGeneration.upload" })).toBeInTheDocument();
  expect(screen.getByLabelText("leafletPro.prompts")).toBeInTheDocument();
});

test("multiple editors use distinct copy IDs and independent file inputs", async () => {
  const firstUpdate = jest.fn();
  const secondUpdate = jest.fn();
  render(<>
    <FlyerContentStep data={createCreativeDefaults()} onUpdate={firstUpdate} />
    <FlyerContentStep data={createCreativeDefaults()} onUpdate={secondUpdate} />
  </>);
  const headers = screen.getAllByLabelText("leafletPro.copyLine");
  expect(headers[0].id).not.toBe(headers[1].id);
  const input = screen.getAllByLabelText("leafletPro.uploadLogo")[1];
  const file = new File(["image"], "logo.png", { type: "image/png" });
  userEvent.upload(input, file);
  await waitFor(() => expect(secondUpdate).toHaveBeenCalledWith(expect.objectContaining({
    logoImage: expect.objectContaining({ file, name: "logo.png", preview: expect.stringMatching(/^data:image/) }),
  })));
  expect(firstUpdate).not.toHaveBeenCalled();
});

test("product photos work without a preinitialized array and file read failures are reported", async () => {
  const onUpdate = jest.fn();
  render(<FlyerContentStep data={{}} onUpdate={onUpdate} />);
  const input = screen.getByLabelText("leafletPro.uploadProduct");
  const file = new File(["image"], "product.png", { type: "image/png" });
  userEvent.upload(input, file);
  await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({
    productPhoto: [expect.objectContaining({ file })],
  }));
  const reader = jest.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function () {
    this.dispatchEvent(new ProgressEvent("error"));
  });
  userEvent.upload(input, new File(["bad"], "broken.png", { type: "image/png" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("flyerContent.imageReadFailed"));
  reader.mockRestore();
});
