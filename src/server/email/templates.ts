import { formatPrice } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export type AppointmentEmailData = {
  clientName: string;
  serviceName: string;
  therapistName: string;
  startsAt: Date;
  priceCents: number;
};

export const CLINIC = {
  name: "Motion Physiotherapy",
  address: "EU",
  phone: "",
};

export function confirmationEmail(data: AppointmentEmailData) {
  const when = formatDateTime(data.startsAt);
  return {
    kind: "appointment-confirmed",
    subject: `Booked: ${data.serviceName} on ${when}`,
    body: [
      `Hi ${data.clientName},`,
      "",
      `Your ${data.serviceName.toLowerCase()} with ${data.therapistName} is booked for ${when}.`,
      `Price: ${formatPrice(data.priceCents)}, paid at the clinic.`,
      "",
      `Where: ${CLINIC.address}`,
      "Wear comfortable clothes and arrive 5 minutes early.",
      "You can cancel online up to 24 hours before the appointment.",
      "",
      CLINIC.name,
    ].join("\n"),
  };
}

export function cancellationEmail(data: AppointmentEmailData & { cancelledByClinic: boolean }) {
  const when = formatDateTime(data.startsAt);
  return {
    kind: "appointment-cancelled",
    subject: `Cancelled: ${data.serviceName} on ${when}`,
    body: [
      `Hi ${data.clientName},`,
      "",
      data.cancelledByClinic
        ? `We had to cancel your ${data.serviceName.toLowerCase()} with ${data.therapistName} on ${when}. We're sorry for the change.`
        : `Your ${data.serviceName.toLowerCase()} with ${data.therapistName} on ${when} is cancelled.`,
      "Book a new time whenever it suits you.",
      "",
      `Questions? Call us on ${CLINIC.phone}.`,
      CLINIC.name,
    ].join("\n"),
  };
}
