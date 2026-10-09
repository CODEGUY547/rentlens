type TemplateComponent = { type: "body"; parameters: { type: "text"; text: string }[] } | { type: "button"; sub_type: "url"; index: string; parameters: { type: "text"; text: string }[] };

export async function sendWhatsAppTemplate(phone: string, templateName: string, language: string, components: TemplateComponent[]) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!phoneId || !token) throw new Error("WhatsApp credentials are not configured");
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "template", template: { name: templateName, language: { code: language }, components } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "WhatsApp rejected the message");
  return data.messages?.[0]?.id as string;
}
