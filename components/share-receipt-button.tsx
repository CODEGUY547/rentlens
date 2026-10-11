"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

type ShareReceiptButtonProps = {
  receiptNumber: string;
  tenantName: string;
};

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function ShareReceiptButton({ receiptNumber, tenantName }: ShareReceiptButtonProps) {
  const [sharing, setSharing] = useState(false);

  async function shareReceipt() {
    const receipt = document.getElementById("rent-receipt-card");
    if (!receipt) return toast.error("The receipt is not ready yet");

    setSharing(true);
    try {
      await document.fonts.ready;
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(receipt, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      });
      if (!blob) throw new Error("Could not create the receipt image");

      const file = new File(
        [blob],
        `${safeFileName(receiptNumber) || "rent-receipt"}.png`,
        { type: "image/png" },
      );
      const shareData = {
        files: [file],
        title: `Rent receipt ${receiptNumber}`,
        text: `Hello ${tenantName}, thank you for your rent payment. Your receipt is attached.`,
      };

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        toast.success("Receipt shared successfully");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success("Receipt image downloaded. Attach it in WhatsApp.");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      toast.error(cause instanceof Error ? cause.message : "Could not share this receipt");
    } finally {
      setSharing(false);
    }
  }

  return (
    <button type="button" className="receipt-share-button" onClick={shareReceipt} disabled={sharing}>
      <Share2 /> {sharing ? "Preparing image…" : "Share receipt image"}
    </button>
  );
}
