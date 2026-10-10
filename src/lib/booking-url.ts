export type BookingParams = { service?: string; therapist?: string; date?: string };

/** Booking state lives in the URL, so every step can be linked, refreshed and shared. */
export function bookHref(params: BookingParams): string {
  const query = new URLSearchParams();
  if (params.service) query.set("service", params.service);
  if (params.therapist) query.set("therapist", params.therapist);
  if (params.date) query.set("date", params.date);
  const text = query.toString();
  return text ? `/book?${text}` : "/book";
}
