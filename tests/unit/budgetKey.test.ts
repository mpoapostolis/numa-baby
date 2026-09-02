import { describe, expect, it } from "vitest";
import { budgetKey } from "../../worker/budgetKey";

// The join and create budgets are keyed per connection, and on IPv6 a
// connection is a /64 — however the address happens to be written.
describe("budgetKey", () => {
  it("keeps an IPv4 address whole", () => {
    expect(budgetKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("keys an IPv6 address by its /64, expanding :: first", () => {
    expect(budgetKey("2001:db8:1:2:3:4:5:6")).toBe("2001:0db8:0001:0002");
    expect(budgetKey("2001:db8::a:b:c:d")).toBe("2001:0db8:0000:0000");
    expect(budgetKey("2001:db8::e:b:c:d")).toBe(budgetKey("2001:db8::a:b:c:d"));
    expect(budgetKey("2001:db8:1::5")).toBe("2001:0db8:0001:0000");
    expect(budgetKey("::1")).toBe("0000:0000:0000:0000");
  });

  it("gives one household one budget whichever of its addresses it uses", () => {
    expect(budgetKey("2a02:1234:5678:9abc::1")).toBe(budgetKey("2a02:1234:5678:9abc:ffff:ffff:ffff:ffff"));
  });
});
