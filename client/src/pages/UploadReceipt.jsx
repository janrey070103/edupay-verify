import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadPayment } from "../api/paymentApi";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/ui/PageHeader";
import { IconFile, IconLoader, IconUpload } from "../components/icons/Icons";

const UploadReceipt = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [studentName, setStudentName] = useState(user?.name ?? "");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const studentId = user?.studentId ?? "";

  const handleFile = (selected) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
      setError("Please upload an image (JPG, PNG) or PDF file.");
      return;
    }
    setError("");
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const submitReceipt = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a receipt file to upload.");
      return;
    }
    if (!studentName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!paymentDescription.trim()) {
      setError("Please describe what this payment is for.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("receipt", file);
      formData.append("studentId", studentId);
      formData.append("studentName", studentName.trim());
      formData.append("paymentDescription", paymentDescription.trim());

      await uploadPayment(formData);

      showToast("Receipt uploaded successfully!", "success");
      navigate("/student");
    } catch (err) {
      const msg = err.response?.data?.message || "Upload failed. Please try again.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Submit Payment Receipt"
        subtitle="Upload your receipt — details will be extracted automatically via OCR."
      />

      <form
        onSubmit={submitReceipt}
        className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
      >
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <h2 className="text-sm font-bold text-gray-800">Receipt Details</h2>
          <p className="text-xs text-gray-500">Fields marked with * are required</p>
        </div>

        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {studentId && (
            <div>
              <label htmlFor="studentId" className="mb-1.5 block text-sm font-medium text-gray-700">
                Student ID
              </label>
              <input
                id="studentId"
                type="text"
                value={studentId}
                readOnly
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
              />
            </div>
          )}

          <div>
            <label htmlFor="studentName" className="mb-1.5 block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="studentName"
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              disabled={loading}
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
              Payment Description <span className="text-red-500">*</span>
            </label>
            <input
              id="description"
              type="text"
              value={paymentDescription}
              onChange={(e) => setPaymentDescription(e.target.value)}
              disabled={loading}
              placeholder="e.g. Tuition - Midterm"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-sti-blue focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="receiptFile" className="mb-1.5 block text-sm font-medium text-gray-700">
              Receipt File <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Choose receipt file"
              className={[
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition",
                dragOver
                  ? "border-sti-blue bg-blue-50/50"
                  : "border-sti-blue/30 bg-gray-50/30 hover:border-sti-blue/50 hover:bg-blue-50/30",
              ].join(" ")}
            >
              <input
                id="receiptFile"
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {preview ? (
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="mb-3 max-h-40 rounded-lg object-contain"
                />
              ) : file ? (
                <IconFile className="mb-3 h-12 w-12 text-sti-blue" />
              ) : (
                <IconUpload className="mb-3 h-12 w-12 text-gray-300" />
              )}
              <p className="text-sm font-semibold text-gray-700">
                {file ? file.name : "Drop your receipt here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-gray-400">JPG, PNG, or PDF</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/student")}
            disabled={loading}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-sti-gold px-5 py-2.5 text-sm font-black text-sti-blue shadow-[0_8px_20px_rgba(255,199,44,0.25)] transition hover:-translate-y-0.5 hover:bg-sti-gold-hover focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {loading ? (
              <>
                <IconLoader className="h-4 w-4" />
                Uploading…
              </>
            ) : (
              "Submit Receipt"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UploadReceipt;
