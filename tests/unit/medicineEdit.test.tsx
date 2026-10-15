/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { seedLog, stubBrowser } from "./appHarness";

// Reported from the feedback box: "I logged the wrong amount of vitamin D
// and I couldn't change it." The edit sheet showed only the time and a note.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  stubBrowser();
});

const startedAt = new Date(Date.now() - 30 * 60_000).toISOString();

async function openEdit() {
  seedLog([{ id: "vitd", type: "medicine", medicine: "Vitamin D", dose: "4 drops", startedAt }]);
  render(<App />);
  const row = await waitFor(() => {
    const found = Array.from(document.querySelectorAll("button")).find((b) => /Vitamin D/.test(b.textContent ?? "") && /4 drops/.test(b.textContent ?? ""));
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(row));
  await screen.findByText("Edit log");
}

function stored() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities.find((a: { id: string }) => a.id === "vitd");
}

test("the amount of a medicine already logged can be corrected", async () => {
  await openEdit();
  const dose = screen.getByLabelText(/How much/) as HTMLInputElement;
  expect(dose.value).toBe("4 drops");
  fireEvent.change(dose, { target: { value: "1 drop" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
  expect(stored()).toMatchObject({ medicine: "Vitamin D", dose: "1 drop" });
}, 15_000);

test("and so can its name, and an amount cleared is cleared", async () => {
  await openEdit();
  fireEvent.change(screen.getByLabelText("What was given"), { target: { value: "Vitamin D3" } });
  fireEvent.change(screen.getByLabelText(/How much/), { target: { value: "" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
  expect(stored().medicine).toBe("Vitamin D3");
  expect(stored().dose).toBeUndefined();
}, 15_000);
