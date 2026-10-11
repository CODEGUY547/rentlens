"use client";

import { Download } from "lucide-react";

export function PrintReceiptButton() {
  return <button className="receipt-print-button" onClick={() => window.print()}><Download /> Print / save as PDF</button>;
}
