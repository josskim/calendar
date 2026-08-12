export const ROOM_PRICE_OPTIONS = [
  {
    id: "201",
    label: "201호",
    description: "기준 4명 · 최대 10명",
    baseGuests: 4,
    maxGuests: 10,
    weekday: 300_000,
    weekend: 350_000,
    peak: 400_000,
  },
  {
    id: "202",
    label: "202호",
    description: "기준 4명 · 최대 8명",
    baseGuests: 4,
    maxGuests: 8,
    weekday: 250_000,
    weekend: 300_000,
    peak: 350_000,
  },
  {
    id: "101",
    label: "101호(독채)",
    description: "기준 2명 · 최대 6명",
    baseGuests: 2,
    maxGuests: 6,
    weekday: 170_000,
    weekend: 220_000,
    peak: 270_000,
  },
] as const;

export type RoomPriceId = (typeof ROOM_PRICE_OPTIONS)[number]["id"];
export type PriceSeason = "weekday" | "weekend" | "peak";

export const EXTRA_GUEST_PRICE = 30_000;
export const BARBECUE_PRICE = 30_000;

export function getPriceSeason(isoDate: string, isHoliday: boolean): PriceSeason {
  const [, monthText, dayText] = isoDate.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  const isPeak = (month === 7 && day >= 15) || (month === 8 && day <= 30);
  if (isPeak) return "peak";

  const date = new Date(`${isoDate}T12:00:00`);
  const weekday = date.getDay();
  return isHoliday || weekday === 0 || weekday === 5 || weekday === 6
    ? "weekend"
    : "weekday";
}

export function calculateReservationPrice(input: {
  selectedRooms: readonly RoomPriceId[];
  guests: number;
  season: PriceSeason;
  barbecue: boolean;
}) {
  const rooms = ROOM_PRICE_OPTIONS.filter((room) => input.selectedRooms.includes(room.id));
  const hasCombinedPension = input.selectedRooms.includes("201") && input.selectedRooms.includes("202");
  const roomPrice = rooms.reduce((sum, room) => sum + room[input.season], 0);
  const baseGuests = rooms.reduce((sum, room) => sum + room.baseGuests, 0) + (hasCombinedPension ? 2 : 0);
  const maxGuests = rooms.reduce((sum, room) => sum + room.maxGuests, 0);
  const extraGuests = rooms.length ? Math.max(0, Math.floor(input.guests) - baseGuests) : 0;
  const extraGuestPrice = extraGuests * EXTRA_GUEST_PRICE;
  const barbecuePrice = input.barbecue && rooms.length ? BARBECUE_PRICE : 0;

  return {
    roomPrice,
    baseGuests,
    maxGuests,
    extraGuests,
    extraGuestPrice,
    barbecuePrice,
    total: roomPrice + extraGuestPrice + barbecuePrice,
    hasCombinedPension,
  };
}
