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
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">Business Name</label>
        <input
          value={business_name}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Chatram Retail Pvt Ltd"
          className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl outline-none transition-all focus:border-stone-900 focus:ring-2 focus:ring-stone-900/15"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-1.5">GST Number</label>
        <input
          value={gst_number}
          onChange={(e) => setGstNumber(e.target.value)}
          placeholder="e.g. 29ABCDE1234F1Z5"
          className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl outline-none transition-all focus:border-stone-900 focus:ring-2 focus:ring-stone-900/15 font-mono"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-stone-900 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
      >
        {loading ? "Registering Business..." : "Register Seller Account"}
      </button>

      {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
    </form>
  );
}
