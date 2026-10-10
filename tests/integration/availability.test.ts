import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, timeOff } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getAvailability } from "@/server/services/availability";
import { setServiceActive } from "@/server/services/catalog";
import { at, clock, insertConfirmed, key, MONDAY_8AM, plusMinutes, TUESDAY, setupClinic } from "./helpers";

const clinic = setupClinic();
const times = (result: Awaited<ReturnType<typeof getAvailability>>) => result.slots.map((s) => clock(s.startsAt));

describe("getAvailability", () => {
  it("lists a therapist's free times inside working hours, around the lunch break", async () => {
    const result = await getAvailability(
      { serviceId: clinic.fx.services.assessment, therapistId: clinic.fx.therapists.emma, date: TUESDAY },
      MONDAY_8AM,
    );
    const list = times(result);
    expect(list[0]).toBe("08:00");
    expect(list).toContain("11:00"); // 11:00–12:00 still fits before the break
    expect(list).not.toContain("11:15");
    expect(list).not.toContain("12:00");
    expect(list).toContain("12:30");
    expect(list.at(-1)).toBe("15:00");
  });

  it("applies the 2-hour notice on the current day", async () => {
    const result = await getAvailability(
      { serviceId: clinic.fx.services.massage, therapistId: clinic.fx.therapists.emma, date: "2030-03-04" },
      MONDAY_8AM,
    );
    expect(times(result)[0]).toBe("10:00");
  });

  it("merges therapists for 'any therapist', including Mark's evenings", async () => {
    const result = await getAvailability({ serviceId: clinic.fx.services.massage, date: TUESDAY }, MONDAY_8AM);
    const at1300 = result.slots.find((s) => clock(s.startsAt) === "13:00");
    expect(at1300?.therapistName).toBe("Emma Hart"); // alphabetical first
    expect(result.slots.find((s) => clock(s.startsAt) === "19:30")?.therapistName).toBe("Mark Cole");
  });

  it("is empty at weekends and for therapists without that service", async () => {
    const saturday = await getAvailability({ serviceId: clinic.fx.services.massage, date: "2030-03-09" }, MONDAY_8AM);
    expect(saturday.slots).toEqual([]);
    await expect(
      getAvailability({ serviceId: clinic.fx.services.assessment, therapistId: clinic.fx.therapists.mark, date: TUESDAY }, MONDAY_8AM),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("removes confirmed appointments, active holds and time off – but not expired holds", async () => {
    const { fx } = clinic;
    const base = { serviceId: fx.services.massage, therapistId: fx.therapists.emma, date: TUESDAY };

    await insertConfirmed({ clientId: fx.users.anna, therapistId: fx.therapists.emma, serviceId: fx.services.massage, startsAt: at(TUESDAY, "09:00") });
    await db.insert(appointments).values([
      {
        clientId: fx.users.ben, therapistId: fx.therapists.emma, serviceId: fx.services.massage,
        startsAt: at(TUESDAY, "10:00"), endsAt: at(TUESDAY, "10:30"), status: "HELD",
        holdExpiresAt: plusMinutes(MONDAY_8AM, 5), idempotencyKey: key(),
      },
      {
        clientId: fx.users.anna, therapistId: fx.therapists.emma, serviceId: fx.services.massage,
        startsAt: at(TUESDAY, "11:00"), endsAt: at(TUESDAY, "11:30"), status: "HELD",
        holdExpiresAt: plusMinutes(MONDAY_8AM, -1), idempotencyKey: key(),
      },
    ]);
    await db.insert(timeOff).values({ therapistId: fx.therapists.emma, startsAt: at(TUESDAY, "13:00"), endsAt: at(TUESDAY, "16:00") });

    const list = times(await getAvailability(base, MONDAY_8AM));
    expect(list).not.toContain("09:00");
    expect(list).not.toContain("08:45"); // would run into 09:00
    expect(list).toContain("09:30");
    expect(list).not.toContain("10:00"); // active hold
    expect(list).toContain("11:00"); // hold already ran out
    expect(list.filter((t) => t >= "13:00")).toEqual([]);
  });

  it("hides inactive services and rejects dates outside the window", async () => {
    await expect(
      getAvailability({ serviceId: clinic.fx.services.massage, date: "2030-03-25" }, MONDAY_8AM),
    ).rejects.toBeInstanceOf(ValidationError);

    await setServiceActive(clinic.as("admin"), clinic.fx.services.massage, false);
    await expect(getAvailability({ serviceId: clinic.fx.services.massage, date: TUESDAY }, MONDAY_8AM)).rejects.toBeInstanceOf(NotFoundError);
  });
});
