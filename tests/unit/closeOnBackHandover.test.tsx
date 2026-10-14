/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useState } from "react";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";

// One tap that closes one surface and opens another — a News button that
// opens Months. The close takes its history entry back with history.back(),
// which the browser carries out AFTER the open has pushed its own: done in
// that order, the open's entry is the one that disappears, and the next
// back gesture closes the app instead of the sheet. (Its own file: the hook
// keeps module state.)

afterEach(() => cleanup());

function News({ onClose, onOpenMonths }: { onClose: () => void; onOpenMonths: () => void }) {
  useCloseOnBack(true, onClose);
  return (
    <button type="button" onClick={() => { onClose(); onOpenMonths(); }}>
      Months
    </button>
  );
}

function Harness() {
  const [news, setNews] = useState(true);
  const [sheet, setSheet] = useState(false);
  useCloseOnBack(sheet, () => setSheet(false));
  return (
    <>
      {news && <News onClose={() => setNews(false)} onOpenMonths={() => setSheet(true)} />}
      {sheet && <p>Months sheet</p>}
    </>
  );
}

const settle = () => act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 50)));

test("closing the news and opening a sheet in one tap leaves back closing the sheet", async () => {
  const start = window.history.length;
  render(<Harness />);
  await settle();
  expect(window.history.length).toBe(start + 1);

  fireEvent.click(screen.getByRole("button", { name: "Months" }));
  await settle();
  expect(screen.getByText("Months sheet")).toBeTruthy();
  // The news entry went, the sheet's took its place: still one step above
  // the app, and it is the sheet's.
  expect(window.history.state).toEqual({ numaSheet: true });
  expect(window.history.length).toBe(start + 1);

  // The back gesture closes the sheet, and the app is still here.
  await act(async () => {
    window.history.back();
  });
  await settle();
  expect(screen.queryByText("Months sheet")).toBeNull();
  expect(window.history.state).toBeNull();
});

// A sheet closed while a page inside it is open: two surfaces leave in one
// tap. Safari (and jsdom) fold two history.back() calls made at once into one
// step — taken one by one, a phantom entry stayed, and the next back gesture
// was swallowed.
function Inner() {
  useCloseOnBack(true, () => {});
  return <p>Month page</p>;
}

function Nested() {
  const [sheet, setSheet] = useState(false);
  const [other, setOther] = useState(false);
  useCloseOnBack(sheet, () => setSheet(false));
  useCloseOnBack(other, () => setOther(false));
  return (
    <>
      <button type="button" onClick={() => setSheet(true)}>Open</button>
      <button type="button" onClick={() => setSheet(false)}>Close</button>
      <button type="button" onClick={() => setOther(true)}>Other</button>
      {sheet && <Inner />}
      {other && <p>Other sheet</p>}
    </>
  );
}

test("a sheet closed with a page open inside it leaves in one step, and back works after", async () => {
  const start = window.history.length;
  render(<Nested />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await settle();
  expect(screen.getByText("Month page")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await settle();
  expect(window.history.state).toBeNull();

  // The next surface gets its entry at once, and back closes it.
  fireEvent.click(screen.getByRole("button", { name: "Other" }));
  await settle();
  expect(window.history.state).toEqual({ numaSheet: true });
  await act(async () => {
    window.history.back();
  });
  await settle();
  expect(screen.queryByText("Other sheet")).toBeNull();
  expect(window.history.length).toBeGreaterThanOrEqual(start);
});
