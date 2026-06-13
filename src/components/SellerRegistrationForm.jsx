import { useState } from "react";
import client from "../api/client";

export default function SellerRegistrationForm({ onSuccess }) {
  const [business_name, setBusinessName] = useState("");
  const [gst_number, setGstNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await client.post("/seller/registration/", {
        business_name,
        gst_number,
      });

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        value={business_name}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Business Name"
        className="border p-2 w-full"
      />

      <input
        value={gst_number}
        onChange={(e) => setGstNumber(e.target.value)}
        placeholder="GST Number"
        className="border p-2 w-full"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-orange-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Creating..." : "Create Seller"}
      </button>

      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
}
